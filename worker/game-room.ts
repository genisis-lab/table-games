import { DurableObject } from "cloudflare:workers";
import {
  applyGameMove,
  canBotStart,
  chooseBotMove,
  createGameState,
  getDefaultBoardVariant,
  getGameDefinition,
  maxPlayersForGame,
  maskGameMetaForPlayer,
  isBoardVariantForGame,
  isBotDifficulty,
  isGameId,
  isSoloGame,
  supportsFriendMode,
  type BotDifficulty,
  type BoardVariant,
  type GameState,
  type GameId,
  type GameMove,
  type PlayerMark
} from "../src/shared/games";
import type {
  ChatMessage,
  ClientMessage,
  AppliedMove,
  ReactionEvent,
  MoveRecord,
  RoomPlayer,
  RoomSnapshot,
  RoomSpectator,
  ServerMessage
} from "../src/shared/protocol";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
}

interface StoredRoom {
  roomId: string;
  gameId: GameId;
  boardVariant: BoardVariant;
  opponent: "friend" | "bot";
  botDifficulty: BotDifficulty;
  botStarts: boolean;
  players: RoomPlayer[];
  spectators: RoomSpectator[];
  game: ReturnType<typeof createGameState>;
  gameHistory: GameState[];
  moveHistory: MoveRecord[];
  chat: ChatMessage[];
  reactionEvents: ReactionEvent[];
  rematchRequests: string[];
  undoRequests: string[];
  createdAt: number;
  updatedAt: number;
}

interface SocketAttachment {
  roomId?: string;
  guestToken?: string;
}

const ROOM_KEY = "room";
const MAX_CHAT_MESSAGES = 80;
const MAX_REACTIONS = 80;
const BOT_NAME = "Spark Bot";
const BOT_MOVE_DELAY_MS = 520;

export class GameRoom extends DurableObject<Env> {
  private room: StoredRoom | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const [, roomId, action] = url.pathname.split("/");

    if (!roomId) {
      return Response.json({ error: "Missing room id." }, { status: 400 });
    }

    if (action === "init" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        gameId?: string;
        opponent?: string;
        botDifficulty?: string;
        botStarts?: boolean;
        boardVariant?: string;
      };
      if (!body.gameId || !isGameId(body.gameId)) {
        return Response.json({ error: "Unknown game." }, { status: 400 });
      }

      const opponent = supportsFriendMode(body.gameId)
        ? body.opponent === "bot" ? "bot" : "friend"
        : "bot";
      const boardVariant = body.boardVariant && isBoardVariantForGame(body.gameId, body.boardVariant)
        ? body.boardVariant
        : getDefaultBoardVariant(body.gameId);
      const room = await this.loadRoom(
        roomId,
        body.gameId,
        opponent,
        body.botDifficulty && isBotDifficulty(body.botDifficulty) ? body.botDifficulty : "ruthless",
        boardVariant,
        Boolean(body.botStarts) && canBotStart(body.gameId)
      );
      await this.saveRoom(room);
      return Response.json(this.snapshot(room), { status: 201 });
    }

    if (action === "snapshot") {
      const room = await this.loadRoom(roomId);
      return Response.json(this.snapshot(room));
    }

    if (action === "socket") {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      server.serializeAttachment({ roomId } satisfies SocketAttachment);
      this.ctx.acceptWebSocket(server);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
      this.send(ws, { type: "error", reason: "Unsupported message." });
      return;
    }

    let clientMessage: ClientMessage;
    try {
      clientMessage = JSON.parse(message) as ClientMessage;
    } catch {
      this.send(ws, { type: "error", reason: "Invalid message." });
      return;
    }

    const attachment = (ws.deserializeAttachment() ?? {}) as SocketAttachment;
    const roomId = this.getRoomIdFromSocketUrl(ws);
    const room = await this.loadRoom(roomId);

    switch (clientMessage.type) {
      case "join":
        await this.handleJoin(ws, room, clientMessage.guestToken, clientMessage.name);
        return;
      case "make_move":
        await this.handleMove(ws, room, attachment.guestToken, clientMessage.move);
        return;
      case "send_chat":
        await this.handleChat(ws, room, attachment.guestToken, clientMessage.body);
        return;
      case "send_reaction":
        await this.handleReaction(ws, room, attachment.guestToken, clientMessage.emoji);
        return;
      case "request_rematch":
        await this.handleRematch(ws, room, attachment.guestToken);
        return;
      case "request_undo":
        await this.handleUndo(ws, room, attachment.guestToken);
        return;
      case "claim_seat":
        await this.handleClaimSeat(ws, room, attachment.guestToken);
        return;
      case "switch_game":
        await this.handleSwitchGame(ws, room, attachment.guestToken, clientMessage.gameId);
        return;
      case "set_board_variant":
        await this.handleSetBoardVariant(ws, room, attachment.guestToken, clientMessage.variant);
        return;
      case "set_bot_difficulty":
        await this.handleSetBotDifficulty(ws, room, attachment.guestToken, clientMessage.difficulty);
        return;
      case "set_bot_starts":
        await this.handleSetBotStarts(ws, room, attachment.guestToken, clientMessage.botStarts);
        return;
      default:
        this.send(ws, { type: "error", reason: "Unknown message type." });
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = (ws.deserializeAttachment() ?? {}) as SocketAttachment;
    if (!attachment.guestToken) return;

    const room = await this.loadRoom(this.getRoomIdFromSocketUrl(ws));
    let changed = false;

    for (const player of room.players) {
      if (player.guestToken === attachment.guestToken) {
        player.connected = false;
        changed = true;
      }
    }

    for (const spectator of room.spectators) {
      if (spectator.guestToken === attachment.guestToken) {
        spectator.connected = false;
        changed = true;
      }
    }

    if (changed) {
      room.updatedAt = Date.now();
      await this.saveRoom(room);
      this.broadcastRoom(room, (snapshot) => ({ type: "presence_changed", room: snapshot }));
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  private async handleJoin(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string,
    rawName: string
  ): Promise<void> {
    const name = cleanName(rawName);
    if (!guestToken || guestToken.length > 100) {
      this.send(ws, { type: "error", reason: "Missing guest token." });
      return;
    }

    const attachment = (ws.deserializeAttachment() ?? {}) as SocketAttachment;
    ws.serializeAttachment({ ...attachment, guestToken } satisfies SocketAttachment);

    const existingPlayer = room.players.find((player) => player.guestToken === guestToken);
    const existingSpectator = room.spectators.find(
      (spectator) => spectator.guestToken === guestToken
    );

    if (existingPlayer) {
      existingPlayer.name = name;
      existingPlayer.connected = true;
    } else if (existingSpectator) {
      existingSpectator.name = name;
      existingSpectator.connected = true;
    } else if (availablePlayerMark(room)) {
      room.players.push({
        guestToken,
        name,
        mark: availablePlayerMark(room)!,
        connected: true,
        joinedAt: Date.now()
      });
    } else {
      room.spectators.push({
        guestToken,
        name,
        connected: true,
        joinedAt: Date.now()
      });
    }

    room.updatedAt = Date.now();
    await this.saveRoom(room);

    this.sendRoom(ws, room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
    this.broadcastRoom(room, (snapshot) => ({ type: "presence_changed", room: snapshot }));
  }

  private async handleMove(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined,
    move: GameMove
  ): Promise<void> {
    const player = this.findPlayer(room, guestToken);
    if (!player) {
      this.send(ws, { type: "error", reason: "Only seated players can move." });
      return;
    }

    const result = applyGameMove(room.game, player.mark, move);
    if (!result.ok) {
      this.send(ws, { type: "error", reason: result.reason });
      return;
    }

    room.gameHistory = [...room.gameHistory, cloneGameState(room.game)].slice(-30);
    room.game = result.state;
    room.moveHistory = [...room.moveHistory, createMoveRecord(player, move, result.point, room.gameId)].slice(-40);
    room.undoRequests = [];
    room.rematchRequests = [];
    room.updatedAt = Date.now();
    await this.saveRoom(room);

    const appliedMove = createAppliedMove(player.mark, move, result.point);
    this.broadcastRoom(room, (snapshot) => ({
      type: "move_applied",
      room: snapshot,
      move: appliedMove
    }));

    if (room.game.winner) {
      this.broadcastRoom(room, (snapshot) => ({ type: "game_over", room: snapshot, winner: snapshot.winner }));
      return;
    }

    await this.maybePlayBot(room);
  }

  private async handleChat(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined,
    body: string
  ): Promise<void> {
    const participant = this.findParticipant(room, guestToken);
    if (!participant) {
      this.send(ws, { type: "error", reason: "Join the room before chatting." });
      return;
    }

    const cleanBody = String(body ?? "").trim().slice(0, 180);
    if (!cleanBody) {
      this.send(ws, { type: "error", reason: "Chat message is empty." });
      return;
    }

    const chat: ChatMessage = {
      id: crypto.randomUUID(),
      guestToken: participant.guestToken,
      name: participant.name,
      body: cleanBody,
      at: Date.now()
    };

    room.chat = [...room.chat, chat].slice(-MAX_CHAT_MESSAGES);
    room.updatedAt = Date.now();
    await this.saveRoom(room);

    this.broadcastRoom(room, (snapshot) => ({ type: "chat_added", room: snapshot, chat }));
  }

  private async handleReaction(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined,
    emoji: string
  ): Promise<void> {
    const participant = this.findParticipant(room, guestToken);
    if (!participant) {
      this.send(ws, { type: "error", reason: "Join the room before reacting." });
      return;
    }
    const spectator = room.spectators.find((candidate) => candidate.guestToken === participant.guestToken);
    if (spectator && !room.game.winner) {
      this.send(ws, { type: "error", reason: "Spectators can react after the game ends." });
      return;
    }

    const reaction: ReactionEvent = {
      id: crypto.randomUUID(),
      guestToken: participant.guestToken,
      name: participant.name,
      emoji: String(emoji ?? "⭐").slice(0, 8),
      at: Date.now()
    };

    room.reactionEvents = [...room.reactionEvents, reaction].slice(-MAX_REACTIONS);
    room.updatedAt = Date.now();
    await this.saveRoom(room);

    this.broadcastRoom(room, (snapshot) => ({ type: "reaction_added", room: snapshot, reaction }));
  }

  private async handleRematch(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined
  ): Promise<void> {
    if (!this.findPlayer(room, guestToken)) {
      this.send(ws, { type: "error", reason: "Only seated players can start a rematch." });
      return;
    }

    if (room.opponent === "friend") {
      addUnique(room.rematchRequests, guestToken);
      if (!hasAllHumanPlayerVotes(room, room.rematchRequests)) {
        room.updatedAt = Date.now();
        await this.saveRoom(room);
        this.broadcastRoom(room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
        return;
      }
    }

    await this.resetGame(room);
    this.broadcastRoom(room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
    await this.maybePlayBot(room);
  }

  private async handleUndo(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined
  ): Promise<void> {
    if (!this.findPlayer(room, guestToken)) {
      this.send(ws, { type: "error", reason: "Only seated players can request undo." });
      return;
    }

    if (room.opponent !== "friend") {
      this.send(ws, { type: "error", reason: "Undo requests are for friend rooms." });
      return;
    }

    if (room.gameHistory.length === 0) {
      this.send(ws, { type: "error", reason: "No move to undo yet." });
      return;
    }

    addUnique(room.undoRequests, guestToken);
    if (!hasAllHumanPlayerVotes(room, room.undoRequests)) {
      room.updatedAt = Date.now();
      await this.saveRoom(room);
      this.broadcastRoom(room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
      return;
    }

    const previous = room.gameHistory.at(-1);
    if (!previous) return;
    room.game = previous;
    room.gameHistory = room.gameHistory.slice(0, -1);
    room.moveHistory = room.moveHistory.slice(0, -1);
    room.undoRequests = [];
    room.rematchRequests = [];
    room.updatedAt = Date.now();
    await this.saveRoom(room);
    this.broadcastRoom(room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
  }

  private async handleClaimSeat(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined
  ): Promise<void> {
    const spectator = room.spectators.find((candidate) => candidate.guestToken === guestToken);
    if (!spectator) {
      this.send(ws, { type: "error", reason: "Only spectators can claim a seat." });
      return;
    }

    const openPlayer = room.players.find((player) => !player.connected && !player.isBot);
    const mark = openPlayer?.mark ?? availablePlayerMark(room);
    if (!mark) {
      this.send(ws, { type: "error", reason: "No seat is open yet." });
      return;
    }

    room.players = room.players.filter((player) => player.mark !== mark);
    room.players.push({
      guestToken: spectator.guestToken,
      name: spectator.name,
      mark,
      connected: true,
      joinedAt: Date.now()
    });
    room.spectators = room.spectators.filter((candidate) => candidate.guestToken !== spectator.guestToken);
    room.undoRequests = [];
    room.rematchRequests = [];
    room.updatedAt = Date.now();
    await this.saveRoom(room);
    this.sendRoom(ws, room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
    this.broadcastRoom(room, (snapshot) => ({ type: "presence_changed", room: snapshot }));
  }

  private async handleSwitchGame(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined,
    gameId: GameId
  ): Promise<void> {
    const player = this.findPlayer(room, guestToken);
    if (!player) {
      this.send(ws, { type: "error", reason: "Only seated players can switch games." });
      return;
    }

    if (!canChangeRoomSettings(room, player)) {
      this.send(ws, { type: "error", reason: "Only the host can change games." });
      return;
    }

    if (!isGameId(gameId)) {
      this.send(ws, { type: "error", reason: "Unknown game." });
      return;
    }

    if (!supportsFriendMode(gameId)) {
      room.opponent = "bot";
      if (isSoloGame(gameId)) prepareSoloPlayers(room);
      else ensureBotPlayers(room);
    }

    room.gameId = gameId;
    room.botStarts = room.opponent === "bot" && room.botStarts && canBotStart(gameId);
    trimPlayersForGame(room);
    if (room.opponent === "bot" && !isSoloGame(gameId)) ensureBotPlayers(room);
    room.boardVariant = getDefaultBoardVariant(gameId);
    await this.resetGame(room);
    this.broadcastRoom(room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
    await this.maybePlayBot(room);
  }

  private async handleSetBoardVariant(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined,
    variant: BoardVariant
  ): Promise<void> {
    const player = this.findPlayer(room, guestToken);
    if (!player) {
      this.send(ws, { type: "error", reason: "Only seated players can resize the board." });
      return;
    }

    if (!canChangeRoomSettings(room, player)) {
      this.send(ws, { type: "error", reason: "Only the host can change the board." });
      return;
    }

    if (!isBoardVariantForGame(room.gameId, variant)) {
      this.send(ws, { type: "error", reason: "That board size is not available for this game." });
      return;
    }

    room.boardVariant = variant;
    await this.resetGame(room);
    this.broadcastRoom(room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
    await this.maybePlayBot(room);
  }

  private async handleSetBotDifficulty(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined,
    difficulty: BotDifficulty
  ): Promise<void> {
    const player = this.findPlayer(room, guestToken);
    if (!player) {
      this.send(ws, { type: "error", reason: "Only seated players can adjust the bot." });
      return;
    }

    if (!canChangeRoomSettings(room, player)) {
      this.send(ws, { type: "error", reason: "Only the host can change bot mode." });
      return;
    }

    if (room.opponent !== "bot") {
      this.send(ws, { type: "error", reason: "This room is set up for friend play." });
      return;
    }

    if (!isBotDifficulty(difficulty)) {
      this.send(ws, { type: "error", reason: "Unknown bot mode." });
      return;
    }

    room.botDifficulty = difficulty;
    room.updatedAt = Date.now();
    await this.saveRoom(room);
    this.broadcastRoom(room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
  }

  private async handleSetBotStarts(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined,
    botStarts: boolean
  ): Promise<void> {
    const player = this.findPlayer(room, guestToken);
    if (!player) {
      this.send(ws, { type: "error", reason: "Only seated players can adjust the bot." });
      return;
    }

    if (!canChangeRoomSettings(room, player)) {
      this.send(ws, { type: "error", reason: "Only the host can change bot order." });
      return;
    }

    if (room.opponent !== "bot" || !canBotStart(room.gameId)) {
      this.send(ws, { type: "error", reason: "Bot starts is not available for this game." });
      return;
    }

    room.botStarts = Boolean(botStarts);
    await this.resetGame(room);
    this.broadcastRoom(room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
    await this.maybePlayBot(room);
  }

  private async maybePlayBot(room: StoredRoom): Promise<void> {
    if (room.opponent !== "bot" || room.game.winner) return;

    const bot = room.players.find((player) => player.isBot && player.mark === room.game.turn);
    if (!bot) return;

    const delayMs = room.gameId === "four-in-a-row" && room.botDifficulty === "ruthless" ? 80 : BOT_MOVE_DELAY_MS;
    await sleep(delayMs);

    const move = chooseBotMove(room.game, bot.mark, room.botDifficulty);
    if (!move) return;

    const result = applyGameMove(room.game, bot.mark, move);
    if (!result.ok) return;

    room.gameHistory = [...room.gameHistory, cloneGameState(room.game)].slice(-30);
    room.game = result.state;
    room.moveHistory = [...room.moveHistory, createMoveRecord(bot, move, result.point, room.gameId)].slice(-40);
    room.undoRequests = [];
    room.rematchRequests = [];
    room.updatedAt = Date.now();
    await this.saveRoom(room);

    const appliedMove = createAppliedMove(bot.mark, move, result.point);
    this.broadcastRoom(room, (snapshot) => ({
      type: "move_applied",
      room: snapshot,
      move: appliedMove
    }));

    if (room.game.winner) {
      this.broadcastRoom(room, (snapshot) => ({ type: "game_over", room: snapshot, winner: snapshot.winner }));
    } else if (room.players.some((player) => player.isBot && player.mark === room.game.turn)) {
      await this.maybePlayBot(room);
    }
  }

  private findPlayer(room: StoredRoom, guestToken: string | undefined): RoomPlayer | undefined {
    return room.players.find((player) => player.guestToken === guestToken);
  }

  private findParticipant(
    room: StoredRoom,
    guestToken: string | undefined
  ): RoomPlayer | RoomSpectator | undefined {
    return (
      room.players.find((player) => player.guestToken === guestToken) ??
      room.spectators.find((spectator) => spectator.guestToken === guestToken)
    );
  }

  private async loadRoom(
    roomId: string,
    gameId: GameId = "four-in-a-row",
    opponent: "friend" | "bot" = "friend",
    botDifficulty: BotDifficulty = "ruthless",
    boardVariant: BoardVariant = getDefaultBoardVariant(gameId),
    botStarts = false
  ): Promise<StoredRoom> {
    if (this.room) return this.ensureRoomShape(this.room, roomId);

    const stored = await this.ctx.storage.get<StoredRoom>(ROOM_KEY);
    if (stored) {
      this.room = this.ensureRoomShape(stored, roomId);
      return stored;
    }

    const now = Date.now();
    this.room = {
      roomId,
      gameId,
      boardVariant,
      opponent,
      botDifficulty,
      botStarts: botStarts && canBotStart(gameId),
      players: opponent === "bot" && !isSoloGame(gameId) ? createBotPlayers(roomId, now, gameId) : [],
      spectators: [],
      game: createGameState(gameId, boardVariant),
      gameHistory: [],
      moveHistory: [],
      chat: [],
      reactionEvents: [],
      rematchRequests: [],
      undoRequests: [],
      createdAt: now,
      updatedAt: now
    };
    if (this.room.botStarts && canBotStart(gameId)) {
      const bot = this.room.players.find((player) => player.isBot);
      if (bot) this.room.game.turn = bot.mark;
    }
    return this.room;
  }

  private async saveRoom(room: StoredRoom): Promise<void> {
    this.room = room;
    await this.ctx.storage.put(ROOM_KEY, room);
  }

  private snapshot(room: StoredRoom, guestToken?: string): RoomSnapshot {
    const viewerMark = room.players.find((player) => player.guestToken === guestToken)?.mark;
    return {
      roomId: room.roomId,
      gameId: room.gameId,
      boardVariant: room.boardVariant,
      opponent: room.opponent,
      botDifficulty: room.botDifficulty,
      botStarts: room.botStarts,
      players: [...room.players].sort((a, b) => a.mark.localeCompare(b.mark)),
      spectators: room.spectators,
      board: room.game.board,
      turn: room.game.turn,
      winner: room.game.winner,
      winningLine: room.game.winningLine,
      moveCount: room.game.moveCount,
      meta: maskGameMetaForPlayer(room.game.meta, viewerMark),
      chat: room.chat,
      reactionEvents: room.reactionEvents,
      moveHistory: room.moveHistory,
      rematchRequests: room.rematchRequests,
      undoRequests: room.undoRequests,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    };
  }

  private sendRoom(
    ws: WebSocket,
    room: StoredRoom,
    makeMessage: (snapshot: RoomSnapshot) => ServerMessage
  ): void {
    const attachment = (ws.deserializeAttachment() ?? {}) as SocketAttachment;
    this.send(ws, makeMessage(this.snapshot(room, attachment.guestToken)));
  }

  private broadcastRoom(
    room: StoredRoom,
    makeMessage: (snapshot: RoomSnapshot) => ServerMessage
  ): void {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const attachment = (socket.deserializeAttachment() ?? {}) as SocketAttachment;
        socket.send(JSON.stringify(makeMessage(this.snapshot(room, attachment.guestToken))));
      } catch {
        // Dead sockets are handled by the close/error hooks.
      }
    }
  }

  private ensureRoomShape(room: StoredRoom, roomId: string): StoredRoom {
    room.opponent ??= "friend";
    room.botDifficulty ??= "ruthless";
    room.botStarts ??= false;
    room.boardVariant ??= room.game?.boardVariant ?? getDefaultBoardVariant(room.gameId);
    room.game.boardVariant ??= room.boardVariant;
    room.gameHistory ??= [];
    room.moveHistory ??= [];
    room.rematchRequests ??= [];
    room.undoRequests ??= [];

    if (isSoloGame(room.gameId)) {
      prepareSoloPlayers(room);
    } else if (room.opponent === "bot") {
      ensureBotPlayers(room);
    }

    return room;
  }

  private async resetGame(room: StoredRoom): Promise<void> {
    room.game = createGameState(room.gameId, room.boardVariant);
    if (room.opponent === "bot" && room.botStarts && canBotStart(room.gameId)) {
      const bot = room.players.find((player) => player.isBot);
      if (bot) room.game.turn = bot.mark;
    }
    room.gameHistory = [];
    room.moveHistory = [];
    room.undoRequests = [];
    room.rematchRequests = [];
    room.updatedAt = Date.now();
    await this.saveRoom(room);
  }

  private broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        // Dead sockets are handled by the close/error hooks.
      }
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    ws.send(JSON.stringify(message));
  }

  private getRoomIdFromSocketUrl(ws: WebSocket): string {
    const attachment = (ws.deserializeAttachment() ?? {}) as SocketAttachment & {
      roomId?: string;
    };
    return attachment.roomId ?? this.room?.roomId ?? "room-direct";
  }
}

function cleanName(value: string): string {
  const trimmed = String(value ?? "").trim().slice(0, 24);
  return trimmed || "Guest";
}

function createBotPlayers(roomId: string, joinedAt: number, gameId: GameId): RoomPlayer[] {
  const maxPlayers = maxPlayersForGame(gameId);
  return Array.from({ length: Math.max(1, maxPlayers - 1) }, (_, index) =>
    createBotPlayer(roomId, joinedAt, `p${index + 2}` as PlayerMark)
  );
}

function createBotPlayer(roomId: string, joinedAt: number, mark: PlayerMark = "p2"): RoomPlayer {
  return {
    guestToken: `bot:${roomId}:${mark}`,
    name: mark === "p2" ? BOT_NAME : `${BOT_NAME} ${mark.slice(1)}`,
    mark,
    connected: true,
    joinedAt,
    isBot: true
  };
}

function createMoveRecord(
  player: RoomPlayer,
  move: GameMove,
  point: { row: number; column: number },
  gameId: GameId
): MoveRecord {
  return {
    id: crypto.randomUUID(),
    player: player.mark,
    name: player.name,
    label: moveLabel(move, point, gameId),
    at: Date.now()
  };
}

function createAppliedMove(
  player: PlayerMark,
  move: GameMove,
  point: { row: number; column: number }
): AppliedMove {
  return {
    ...point,
    player,
    edge: move.edge,
    toRow: move.toRow,
    toColumn: move.toColumn,
    at: Date.now()
  };
}

function moveLabel(move: GameMove, point: { row: number; column: number }, gameId: GameId): string {
  if (gameId === "four-in-a-row") return `Column ${point.column + 1}`;
  if (gameId === "dots-and-boxes") {
    return `${move.edge === "h" ? "H" : "V"}${point.row + 1}-${point.column + 1}`;
  }
  if (gameId === "checkers" || gameId === "nine-mens-morris") {
    const from = "row" in move && Number.isInteger(move.row)
      ? `${columnName(move.column)}${(move.row ?? 0) + 1}`
      : "";
    const to = `${columnName(point.column)}${point.row + 1}`;
    return from ? `${from}-${to}` : to;
  }
  if (gameId === "last-card") return point.column < 0 ? "Draw" : `Card ${point.column + 1}`;
  return `${columnName(point.column)}${point.row + 1}`;
}

function columnName(column: number): string {
  return String.fromCharCode(65 + column);
}

function addUnique(values: string[], value: string | undefined): void {
  if (value && !values.includes(value)) values.push(value);
}

function hasAllHumanPlayerVotes(room: StoredRoom, votes: string[]): boolean {
  const humans = room.players.filter((player) => !player.isBot && player.connected);
  return humans.length > 0 && humans.every((player) => votes.includes(player.guestToken));
}

function canChangeRoomSettings(room: StoredRoom, player: RoomPlayer): boolean {
  return player.mark === "p1";
}

function cloneGameState(game: GameState): GameState {
  return JSON.parse(JSON.stringify(game)) as GameState;
}

function availablePlayerMark(room: StoredRoom): PlayerMark | null {
  if (isSoloGame(room.gameId)) {
    return room.players.some((player) => !player.isBot) ? null : "p1";
  }
  for (const mark of playerMarksForGame(room.gameId)) {
    if (!room.players.some((player) => player.mark === mark)) return mark;
  }
  return null;
}

function prepareSoloPlayers(room: StoredRoom): void {
  const humans = room.players.filter((player) => !player.isBot);
  const keeper = humans.find((player) => player.mark === "p1") ?? humans[0];
  const displaced = humans.filter((player) => player !== keeper);

  room.players = keeper ? [{ ...keeper, mark: "p1" }] : [];
  for (const player of displaced) {
    room.spectators.push(toSpectator(player));
  }
}

function ensureBotPlayers(room: StoredRoom): void {
  const marks = playerMarksForGame(room.gameId);
  const now = Date.now();
  for (const mark of marks) {
    if (mark === "p1") continue;
    const human = room.players.find((roomPlayer) => roomPlayer.mark === mark && !roomPlayer.isBot);
    if (human) {
      room.spectators.push(toSpectator(human));
      room.players = room.players.filter((roomPlayer) => roomPlayer !== human);
    }

    const existingBot = room.players.find((roomPlayer) => roomPlayer.isBot && roomPlayer.mark === mark);
    if (existingBot) {
      existingBot.connected = true;
      continue;
    }

    room.players.push(createBotPlayer(room.roomId, now, mark));
  }

  room.players = room.players.filter((player) => !player.isBot || marks.includes(player.mark));
}

function trimPlayersForGame(room: StoredRoom): void {
  const allowed = new Set(playerMarksForGame(room.gameId));
  const keep: RoomPlayer[] = [];
  for (const player of room.players) {
    if (allowed.has(player.mark)) keep.push(player);
    else if (!player.isBot) room.spectators.push(toSpectator(player));
  }
  room.players = keep;
}

function playerMarksForGame(gameId: GameId): PlayerMark[] {
  return (["p1", "p2", "p3", "p4"] as PlayerMark[]).slice(0, maxPlayersForGame(gameId));
}

function toSpectator(player: RoomPlayer): RoomSpectator {
  return {
    guestToken: player.guestToken,
    name: player.name,
    connected: player.connected,
    joinedAt: player.joinedAt
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function roomLabel(mark: PlayerMark, gameId: GameId): string {
  return getGameDefinition(gameId).playerNames[mark] ?? mark.toUpperCase();
}
