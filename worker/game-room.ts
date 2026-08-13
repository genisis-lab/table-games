import { DurableObject } from "cloudflare:workers";
import {
  applyGameMove,
  canBotStart,
  chooseBotMove,
  createGameState,
  finalizeGameState,
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
import { PayloadTooLargeError, readJsonBody } from "./request-body";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  ALLOWED_ORIGINS?: string;
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
}

interface StoredRoom {
  roomId: string;
  gameId: GameId;
  boardVariant: BoardVariant;
  opponent: "friend" | "bot";
  botDifficulty: BotDifficulty;
  botStarts: boolean;
  readyAt: number | null;
  players: RoomPlayer[];
  spectators: RoomSpectator[];
  game: ReturnType<typeof createGameState>;
  gameHistory: GameState[];
  moveHistory: MoveRecord[];
  chat: ChatMessage[];
  reactionEvents: ReactionEvent[];
  rematchRequests: string[];
  undoRequests: string[];
  revision: number;
  processedCommandIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface SocketAttachment {
  roomId?: string;
  guestToken?: string;
  recentMessages?: number[];
  recentChatMessages?: number[];
  recentReactionMessages?: number[];
}

const ROOM_KEY = "room";
const ROOM_INACTIVITY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CHAT_MESSAGES = 80;
const MAX_REACTIONS = 80;
const MAX_MESSAGE_BYTES = 8_192;
const MESSAGE_RATE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 60;
const MAX_CHAT_MESSAGES_PER_WINDOW = 8;
const MAX_REACTIONS_PER_WINDOW = 12;
const MAX_PROCESSED_COMMANDS = 160;
const SEAT_RECONNECT_GRACE_MS = 20_000;
const BOT_NAME = "Spark Bot";
const BOT_MOVE_DELAY_MS = 520;
const RUTHLESS_FOUR_BOT_DELAY_MS = 20;
const WORD_HUNT_BOT_DELAY_MS: Record<BotDifficulty, number> = {
  casual: 1800,
  sharp: 1200,
  ruthless: 750
};
const SET_TRIO_BOT_DELAY_MS: Record<BotDifficulty, number> = {
  casual: 1600,
  sharp: 1100,
  ruthless: 750
};
const DARTS_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;
const DARTS_BULL_INDEX = 20;
const DARTS_DOUBLE_BULL_INDEX = 21;
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{6,100}$/;

export class GameRoom extends DurableObject<Env> {
  private room: StoredRoom | null = null;
  private activeWordHuntBotRooms = new Set<string>();
  private activeBotRooms = new Set<string>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const [, roomId, action] = url.pathname.split("/");

    if (!roomId) {
      return Response.json({ error: "Missing room id." }, { status: 400 });
    }

    if (action === "init" && request.method === "POST") {
      let parsedBody: unknown;
      try {
        parsedBody = await readJsonBody(request, 8 * 1024);
      } catch (error) {
        const oversized = error instanceof PayloadTooLargeError;
        return Response.json(
          { error: oversized ? "Request body is too large." : "Invalid request body." },
          { status: oversized ? 413 : 400 }
        );
      }
      const body = (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
        ? parsedBody
        : {}) as {
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
      if (!await this.hasRoom()) {
        return Response.json({ error: "Room not found." }, { status: 404 });
      }
      const room = await this.loadRoom(roomId);
      await this.finalizeRoomIfNeeded(room);
      return Response.json(this.snapshot(room));
    }

    if (action === "socket") {
      if (!await this.hasRoom()) {
        return Response.json({ error: "Room not found." }, { status: 404 });
      }
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

    if (new TextEncoder().encode(message).byteLength > MAX_MESSAGE_BYTES) {
      this.send(ws, { type: "error", reason: "Message is too large." });
      return;
    }

    if (!this.consumeMessageBudget(ws)) {
      this.send(ws, { type: "error", reason: "Too many messages. Slow down." });
      return;
    }

    let parsedMessage: unknown;
    try {
      parsedMessage = JSON.parse(message) as unknown;
    } catch {
      this.send(ws, { type: "error", reason: "Invalid message." });
      return;
    }

    if (!isClientMessage(parsedMessage)) {
      this.send(ws, { type: "error", reason: "Invalid message payload." });
      return;
    }
    const clientMessage: ClientMessage = parsedMessage;

    if (
      clientMessage.type === "send_chat"
      && !this.consumeMessageBudget(ws, "recentChatMessages", MAX_CHAT_MESSAGES_PER_WINDOW)
    ) {
      this.send(ws, { type: "error", reason: "Chat rate limit reached." });
      return;
    }
    if (
      clientMessage.type === "send_reaction"
      && !this.consumeMessageBudget(ws, "recentReactionMessages", MAX_REACTIONS_PER_WINDOW)
    ) {
      this.send(ws, { type: "error", reason: "Reaction rate limit reached." });
      return;
    }

    const attachment = (ws.deserializeAttachment() ?? {}) as SocketAttachment;
    const roomId = this.getRoomIdFromSocketUrl(ws);
    const room = await this.loadRoom(roomId);
    await this.finalizeRoomIfNeeded(room);

    switch (clientMessage.type) {
      case "join":
        await this.handleJoin(ws, room, clientMessage.guestToken, clientMessage.name);
        return;
      case "make_move":
        await this.handleMove(
          ws,
          room,
          attachment.guestToken,
          clientMessage.move,
          clientMessage.commandId,
          clientMessage.expectedRevision
        );
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
    const hasAnotherConnection = this.ctx.getWebSockets().some((socket) => {
      if (socket === ws) return false;
      const other = (socket.deserializeAttachment() ?? {}) as SocketAttachment;
      return other.guestToken === attachment.guestToken;
    });
    if (hasAnotherConnection) return;

    let changed = false;

    for (const player of room.players) {
      if (player.guestToken === attachment.guestToken) {
        player.connected = false;
        player.disconnectedAt = Date.now();
        changed = true;
      }
    }

    for (const spectator of room.spectators) {
      if (spectator.guestToken === attachment.guestToken) {
        spectator.connected = false;
        spectator.disconnectedAt = Date.now();
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

  async alarm(): Promise<void> {
    const room = this.room ?? await this.ctx.storage.get<StoredRoom>(ROOM_KEY) ?? null;
    if (!room) {
      await this.ctx.storage.deleteAll();
      return;
    }
    const expiresAt = room.updatedAt + ROOM_INACTIVITY_TTL_MS;
    if (expiresAt > Date.now()) {
      await this.ctx.storage.setAlarm(expiresAt);
      return;
    }
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.close(1001, "Room expired");
      } catch {
        // A stale socket must not prevent durable cleanup.
      }
    }
    this.activeWordHuntBotRooms.clear();
    this.room = null;
    await this.ctx.storage.deleteAll();
  }

  private async handleJoin(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string,
    rawName: string
  ): Promise<void> {
    const name = cleanName(rawName);
    const wasReady = isRoomReady(room);
    if (!GUEST_TOKEN_PATTERN.test(guestToken)) {
      this.send(ws, { type: "error", reason: "Invalid guest token." });
      return;
    }

    const attachment = (ws.deserializeAttachment() ?? {}) as SocketAttachment;
    ws.serializeAttachment({ ...attachment, guestToken } satisfies SocketAttachment);

    const existingPlayer = room.players.find((player) => player.guestToken === guestToken);
    const existingSpectator = room.spectators.find(
      (spectator) => spectator.guestToken === guestToken
    );
    let seatedParticipant = false;

    if (existingPlayer) {
      existingPlayer.name = name;
      existingPlayer.connected = true;
      delete existingPlayer.disconnectedAt;
      existingPlayer.participantId ??= crypto.randomUUID();
      seatedParticipant = true;
    } else if (existingSpectator) {
      existingSpectator.name = name;
      existingSpectator.connected = true;
      delete existingSpectator.disconnectedAt;
      existingSpectator.participantId ??= crypto.randomUUID();
    } else if (availablePlayerMark(room)) {
      room.players.push({
        guestToken,
        participantId: crypto.randomUUID(),
        name,
        mark: availablePlayerMark(room)!,
        connected: true,
        joinedAt: Date.now()
      });
      seatedParticipant = true;
    } else {
      room.spectators.push({
        guestToken,
        participantId: crypto.randomUUID(),
        name,
        connected: true,
        joinedAt: Date.now()
      });
    }

    if (!wasReady && isRoomReady(room) && room.readyAt === null) {
      room.readyAt = Date.now();
      if (room.gameId === "word-hunt") {
        room.game = createGameState(room.gameId, room.boardVariant);
        room.gameHistory = [];
        room.moveHistory = [];
        room.revision += 1;
      }
    }

    room.updatedAt = Date.now();
    await this.saveRoom(room);

    this.sendRoom(ws, room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
    this.broadcastRoom(room, (snapshot) => ({ type: "presence_changed", room: snapshot }));
    if (seatedParticipant) this.ctx.waitUntil(this.maybePlayBot(room));
  }

  private async handleMove(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined,
    move: GameMove,
    commandId?: string,
    expectedRevision?: number
  ): Promise<void> {
    const player = this.findPlayer(room, guestToken);
    if (!player) {
      this.send(ws, { type: "error", reason: "Only seated players can move." });
      return;
    }
    if (!isRoomReady(room)) {
      this.send(ws, { type: "error", reason: "Waiting for every player to take a seat." });
      return;
    }

    if (room.gameId === "set-trio" && (player.mark === "p1" || player.mark === "p2")) {
      const cooldown = room.game.meta?.setTrio?.cooldowns[player.mark];
      if (cooldown?.expiresAt && cooldown.expiresAt > Date.now()) {
        const seconds = Math.max(0.1, (cooldown.expiresAt - Date.now()) / 1000).toFixed(1);
        this.send(ws, { type: "error", reason: `Wrong trio cooldown: ${seconds}s remaining.` });
        return;
      }
    }

    const commandKey = commandId ? `${guestToken}:${commandId}` : null;
    if (commandKey && room.processedCommandIds.includes(commandKey)) {
      this.sendRoom(ws, room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
      return;
    }
    if (expectedRevision !== undefined && expectedRevision !== room.revision) {
      this.send(ws, { type: "error", reason: "The table changed. Your view has been refreshed." });
      this.sendRoom(ws, room, (snapshot) => ({ type: "room_snapshot", room: snapshot }));
      return;
    }

    const previousGame = room.game;
    const result = applyGameMove(previousGame, player.mark, move);
    if (!result.ok) {
      this.send(ws, { type: "error", reason: result.reason });
      return;
    }

    room.gameHistory = [...room.gameHistory, cloneGameState(room.game)].slice(-30);
    room.game = result.state;
    if (room.gameId === "set-trio" && (player.mark === "p1" || player.mark === "p2")) {
      const setMeta = room.game.meta?.setTrio;
      const cooldown = setMeta?.cooldowns[player.mark];
      if (cooldown && setMeta?.lastClaim?.player === player.mark && !setMeta.lastClaim.valid) {
        cooldown.expiresAt = Date.now() + cooldown.durationMs;
      }
    }
    room.moveHistory = [...room.moveHistory, createMoveRecord(player, move, result.point, room.gameId, previousGame)].slice(-40);
    room.undoRequests = [];
    room.rematchRequests = [];
    room.revision += 1;
    if (commandKey) {
      room.processedCommandIds = [...room.processedCommandIds, commandKey].slice(-MAX_PROCESSED_COMMANDS);
    }
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
      participantId: participant.participantId,
      name: participant.name,
      body: cleanBody,
      at: Date.now()
    };

    room.chat = [...room.chat, chat].slice(-MAX_CHAT_MESSAGES);
    room.updatedAt = Date.now();
    await this.saveRoom(room);

    this.broadcastRoom(room, (snapshot) => ({
      type: "chat_added",
      room: snapshot,
      chat: snapshot.chat.at(-1)!
    }));
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
      participantId: participant.participantId,
      name: participant.name,
      emoji: String(emoji ?? "⭐").slice(0, 8),
      at: Date.now()
    };

    room.reactionEvents = [...room.reactionEvents, reaction].slice(-MAX_REACTIONS);
    room.updatedAt = Date.now();
    await this.saveRoom(room);

    this.broadcastRoom(room, (snapshot) => ({
      type: "reaction_added",
      room: snapshot,
      reaction: snapshot.reactionEvents.at(-1)!
    }));
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

    if (!room.game.winner) {
      this.send(ws, { type: "error", reason: "Finish the current game before starting a rematch." });
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
    room.revision += 1;
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

    const openPlayer = room.players.find((player) =>
      !player.connected
      && !player.isBot
      && (!player.disconnectedAt || Date.now() - player.disconnectedAt >= SEAT_RECONNECT_GRACE_MS)
    );
    if (!openPlayer && room.players.some((player) => !player.connected && !player.isBot)) {
      this.send(ws, { type: "error", reason: "That seat is protected while its player reconnects." });
      return;
    }
    const mark = openPlayer?.mark ?? availablePlayerMark(room);
    if (!mark) {
      this.send(ws, { type: "error", reason: "No seat is open yet." });
      return;
    }

    room.players = room.players.filter((player) => player.mark !== mark);
    room.players.push({
      guestToken: spectator.guestToken,
      participantId: spectator.participantId ?? crypto.randomUUID(),
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
    await this.finalizeRoomIfNeeded(room);
    if (room.opponent !== "bot" || room.game.winner || !isRoomReady(room)) return;

    if (room.gameId === "word-hunt") {
      await this.playWordHuntBotLoop(room);
      return;
    }

    // Reconnects, settings changes, and a rapid human move can all schedule a
    // bot turn at once. A single room loop prevents duplicate moves while
    // still supporting legitimate extra turns (and Set Trio's live race).
    if (this.activeBotRooms.has(room.roomId)) return;
    this.activeBotRooms.add(room.roomId);

    try {
      while (true) {
        await this.finalizeRoomIfNeeded(room);
        if (room.opponent !== "bot" || room.game.winner || !isRoomReady(room)) return;

        const bot = room.gameId === "set-trio"
          ? room.players.find((player) => player.isBot)
          : room.players.find((player) => player.isBot && player.mark === room.game.turn);
        if (!bot) return;

        const delayMs = room.gameId === "set-trio"
          ? SET_TRIO_BOT_DELAY_MS[room.botDifficulty]
          : room.gameId === "four-in-a-row" && room.botDifficulty === "ruthless"
            ? RUTHLESS_FOUR_BOT_DELAY_MS
            : BOT_MOVE_DELAY_MS;
        await sleep(delayMs);

        // The Durable Object can process another request while sleeping. Read
        // the current in-memory room again before choosing or applying a move.
        await this.finalizeRoomIfNeeded(room);
        if (room.opponent !== "bot" || room.game.winner || !isRoomReady(room)) return;
        const currentBot = room.gameId === "set-trio"
          ? room.players.find((player) => player.isBot)
          : room.players.find((player) => player.isBot && player.mark === room.game.turn);
        if (!currentBot) return;

        const move = chooseBotMove(room.game, currentBot.mark, room.botDifficulty);
        if (!move) return;

        const previousGame = room.game;
        const result = applyGameMove(previousGame, currentBot.mark, move);
        if (!result.ok) return;

        room.gameHistory = [...room.gameHistory, cloneGameState(room.game)].slice(-30);
        room.game = result.state;
        room.moveHistory = [...room.moveHistory, createMoveRecord(currentBot, move, result.point, room.gameId, previousGame)].slice(-40);
        room.undoRequests = [];
        room.rematchRequests = [];
        room.revision += 1;
        room.updatedAt = Date.now();
        await this.saveRoom(room);

        const appliedMove = createAppliedMove(currentBot.mark, move, result.point);
        this.broadcastRoom(room, (snapshot) => ({
          type: "move_applied",
          room: snapshot,
          move: appliedMove
        }));

        if (room.game.winner) {
          this.broadcastRoom(room, (snapshot) => ({ type: "game_over", room: snapshot, winner: snapshot.winner }));
          return;
        }

        if (room.gameId !== "set-trio"
          && !room.players.some((player) => player.isBot && player.mark === room.game.turn)) return;
      }
    } finally {
      this.activeBotRooms.delete(room.roomId);
    }
  }

  private async playWordHuntBotLoop(initialRoom: StoredRoom): Promise<void> {
    if (this.activeWordHuntBotRooms.has(initialRoom.roomId)) return;
    this.activeWordHuntBotRooms.add(initialRoom.roomId);

    try {
      let room = initialRoom;
      while (true) {
        await this.finalizeRoomIfNeeded(room);
        if (room.opponent !== "bot" || room.gameId !== "word-hunt" || room.game.winner) return;
        const bot = room.players.find((player) => player.isBot);
        if (!bot) return;

        await sleep(WORD_HUNT_BOT_DELAY_MS[room.botDifficulty]);
        room = await this.loadRoom(room.roomId);
        await this.finalizeRoomIfNeeded(room);
        if (room.opponent !== "bot" || room.gameId !== "word-hunt" || room.game.winner) return;

        const freshBot = room.players.find((player) => player.isBot);
        if (!freshBot) return;
        const move = chooseBotMove(room.game, freshBot.mark, room.botDifficulty);
        if (!move) return;

        const previousGame = room.game;
        const result = applyGameMove(previousGame, freshBot.mark, move);
        if (!result.ok) return;

        room.gameHistory = [...room.gameHistory, cloneGameState(room.game)].slice(-30);
        room.game = result.state;
        room.moveHistory = [...room.moveHistory, createMoveRecord(freshBot, move, result.point, room.gameId, previousGame)].slice(-40);
        room.undoRequests = [];
        room.rematchRequests = [];
        room.revision += 1;
        room.updatedAt = Date.now();
        await this.saveRoom(room);

        const appliedMove = createAppliedMove(freshBot.mark, move, result.point);
        this.broadcastRoom(room, (snapshot) => ({
          type: "move_applied",
          room: snapshot,
          move: appliedMove
        }));

        if (room.game.winner) {
          this.broadcastRoom(room, (snapshot) => ({ type: "game_over", room: snapshot, winner: snapshot.winner }));
          return;
        }
      }
    } finally {
      this.activeWordHuntBotRooms.delete(initialRoom.roomId);
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
      if ((await this.ctx.storage.getAlarm()) === null) {
        await this.ctx.storage.setAlarm(this.room.updatedAt + ROOM_INACTIVITY_TTL_MS);
      }
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
      readyAt: null,
      players: opponent === "bot" && !isSoloGame(gameId) ? createBotPlayers(roomId, now, gameId) : [],
      spectators: [],
      game: createGameState(gameId, boardVariant),
      gameHistory: [],
      moveHistory: [],
      chat: [],
      reactionEvents: [],
      rematchRequests: [],
      undoRequests: [],
      revision: 0,
      processedCommandIds: [],
      createdAt: now,
      updatedAt: now
    };
    if (this.room.botStarts && canBotStart(gameId)) {
      const bot = this.room.players.find((player) => player.isBot);
      if (bot) this.room.game.turn = bot.mark;
    }
    return this.room;
  }

  private async hasRoom(): Promise<boolean> {
    return this.room !== null || Boolean(await this.ctx.storage.get<StoredRoom>(ROOM_KEY));
  }

  private async saveRoom(room: StoredRoom): Promise<void> {
    this.room = room;
    await this.ctx.storage.put(ROOM_KEY, room);
    await this.ctx.storage.setAlarm(room.updatedAt + ROOM_INACTIVITY_TTL_MS);
  }

  private async finalizeRoomIfNeeded(room: StoredRoom): Promise<void> {
    if (!isRoomReady(room)) return;
    const previousWinner = room.game.winner;
    const finalized = finalizeGameState(room.game);
    if (finalized === room.game) return;

    room.game = finalized;
    room.revision += 1;
    room.updatedAt = Date.now();
    await this.saveRoom(room);

    if (!previousWinner && room.game.winner) {
      this.broadcastRoom(room, (snapshot) => ({ type: "game_over", room: snapshot, winner: snapshot.winner }));
    }
  }

  private snapshot(room: StoredRoom, guestToken?: string): RoomSnapshot {
    const viewerPlayer = room.players.find((player) => player.guestToken === guestToken);
    const viewerSpectator = room.spectators.find((spectator) => spectator.guestToken === guestToken);
    const viewerMark = viewerPlayer?.mark;
    const publicId = (token: string, participantId?: string): string =>
      participantId ?? room.players.find((player) => player.guestToken === token)?.participantId
      ?? room.spectators.find((spectator) => spectator.guestToken === token)?.participantId
      ?? `participant-${token.length}`;
    const publicPlayers = [...room.players]
      .sort((a, b) => a.mark.localeCompare(b.mark))
      .map(({ guestToken: privateToken, ...player }) => ({
        ...player,
        participantId: publicId(privateToken, player.participantId),
        guestToken: publicId(privateToken, player.participantId)
      }));
    const publicSpectators = room.spectators.map(({ guestToken: privateToken, ...spectator }) => ({
      ...spectator,
      participantId: publicId(privateToken, spectator.participantId),
      guestToken: publicId(privateToken, spectator.participantId)
    }));
    const publicChat = room.chat.map(({ guestToken: privateToken, ...chat }) => ({
      ...chat,
      participantId: publicId(privateToken, chat.participantId),
      guestToken: publicId(privateToken, chat.participantId)
    }));
    const publicReactions = room.reactionEvents.map(({ guestToken: privateToken, ...reaction }) => ({
      ...reaction,
      participantId: publicId(privateToken, reaction.participantId),
      guestToken: publicId(privateToken, reaction.participantId)
    }));
    return {
      roomId: room.roomId,
      gameId: room.gameId,
      boardVariant: room.boardVariant,
      opponent: room.opponent,
      botDifficulty: room.botDifficulty,
      botStarts: room.botStarts,
      phase: room.game.winner ? "complete" : isRoomReady(room) ? "active" : "waiting",
      readyAt: room.readyAt,
      players: publicPlayers,
      spectators: publicSpectators,
      board: room.game.board,
      turn: room.game.turn,
      winner: room.game.winner,
      winningLine: room.game.winningLine,
      moveCount: room.game.moveCount,
      meta: maskGameMetaForPlayer(room.game.meta, viewerMark),
      chat: publicChat,
      reactionEvents: publicReactions,
      moveHistory: room.moveHistory,
      rematchRequests: room.rematchRequests.map((token) => publicId(token)),
      undoRequests: room.undoRequests.map((token) => publicId(token)),
      revision: room.revision,
      you: viewerPlayer
        ? { participantId: publicId(viewerPlayer.guestToken, viewerPlayer.participantId), role: "player", mark: viewerPlayer.mark }
        : viewerSpectator
          ? { participantId: publicId(viewerSpectator.guestToken, viewerSpectator.participantId), role: "spectator" }
          : null,
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
    room.readyAt ??= null;
    room.boardVariant ??= room.game?.boardVariant ?? getDefaultBoardVariant(room.gameId);
    room.game.boardVariant ??= room.boardVariant;
    room.gameHistory ??= [];
    room.moveHistory ??= [];
    room.rematchRequests ??= [];
    room.undoRequests ??= [];
    room.revision ??= 0;
    room.processedCommandIds ??= [];
    for (const player of room.players) player.participantId ??= crypto.randomUUID();
    for (const spectator of room.spectators) spectator.participantId ??= crypto.randomUUID();
    for (const chat of room.chat) chat.participantId ??= publicParticipantId(room, chat.guestToken);
    for (const reaction of room.reactionEvents) reaction.participantId ??= publicParticipantId(room, reaction.guestToken);

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
    room.revision += 1;
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

  private consumeMessageBudget(
    ws: WebSocket,
    key: "recentMessages" | "recentChatMessages" | "recentReactionMessages" = "recentMessages",
    limit = MAX_MESSAGES_PER_WINDOW
  ): boolean {
    const attachment = (ws.deserializeAttachment() ?? {}) as SocketAttachment;
    const now = Date.now();
    const recentMessages = (attachment[key] ?? []).filter(
      (timestamp) => timestamp > now - MESSAGE_RATE_WINDOW_MS
    );
    if (recentMessages.length >= limit) {
      attachment[key] = recentMessages;
      ws.serializeAttachment(attachment);
      return false;
    }
    recentMessages.push(now);
    attachment[key] = recentMessages;
    ws.serializeAttachment(attachment satisfies SocketAttachment);
    return true;
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
    guestToken: `bot:${crypto.randomUUID()}`,
    participantId: `bot-seat:${roomId}:${mark}`,
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
  gameId: GameId,
  previousGame?: GameState
): MoveRecord {
  return {
    id: crypto.randomUUID(),
    player: player.mark,
    name: player.name,
    label: moveLabel(move, point, gameId, previousGame),
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

function moveLabel(move: GameMove, point: { row: number; column: number }, gameId: GameId, previousGame?: GameState): string {
  if (gameId === "four-in-a-row") return `Column ${point.column + 1}`;
  if (gameId === "dots-and-boxes") {
    return `${move.edge === "h" ? "H" : "V"}${point.row + 1}-${point.column + 1}`;
  }
  if (gameId === "checkers") {
    const from = "row" in move && Number.isInteger(move.row)
      ? `${columnName(move.column)}${(move.row ?? 0) + 1}`
      : "";
    const to = `${columnName(point.column)}${point.row + 1}`;
    return from ? `${from}-${to}` : to;
  }
  if (gameId === "nine-mens-morris") {
    const to = `${columnName(point.column)}${point.row + 1}`;
    if (previousGame?.meta?.morris?.pendingRemoval) return `Remove ${to}`;
    if (Number.isInteger(move.toRow) && Number.isInteger(move.toColumn)) {
      const from = `${columnName(move.column)}${(move.row ?? 0) + 1}`;
      return `${from}-${to}`;
    }
    return `Point ${to}`;
  }
  if (gameId === "last-card") return point.column < 0 ? "Draw" : `Card ${point.column + 1}`;
  if (gameId === "battleship") return `Fire ${columnName(point.column)}${point.row + 1}`;
  if (gameId === "mancala") return `Pit ${point.column + 1}`;
  if (gameId === "darts") return dartsMoveLabel(point);
  if (gameId === "word-hunt") return move.word ? String(move.word).toUpperCase() : "Time";
  if (gameId === "cup-pong") return point.column < 0 ? "Re-rack" : `Cup ${point.column + 1}`;
  if (gameId === "dominoes") {
    if (point.column < 0) return move.edge === "h" ? "Draw" : "Pass";
    return `Tile ${point.column + 1} ${point.row === 0 ? "left" : "right"}`;
  }
  if (gameId === "order-and-chaos") return `${move.piece ?? "X"} at ${columnName(point.column)}${point.row + 1}`;
  if (gameId === "memory-match") return `Flip ${point.row + 1}-${point.column + 1}`;
  if (gameId === "quoridor") {
    return move.edge ? `${move.edge.toUpperCase()} wall ${point.row + 1}-${point.column + 1}` : `Pawn ${columnName(point.column)}${point.row + 1}`;
  }
  if (gameId === "dice-duel") return move.action === "bank" ? "Bank" : "Roll";
  if (gameId === "chess") {
    const from = `${columnName(move.column)}${8 - (move.row ?? 0)}`;
    const to = `${columnName(move.toColumn ?? point.column)}${8 - (move.toRow ?? point.row)}`;
    return `${from}-${to}${move.promotion ? `=${move.promotion.toUpperCase()}` : ""}`;
  }
  if (gameId === "set-trio") return "Claim trio";
  return `${columnName(point.column)}${point.row + 1}`;
}

function dartsMoveLabel(point: { row: number; column: number }): string {
  if (point.column < 0 || point.row === 0) return "Miss";
  if (point.column === DARTS_BULL_INDEX) return "Bull";
  if (point.column === DARTS_DOUBLE_BULL_INDEX) return "Double Bull";
  const segment = DARTS_SEGMENTS[point.column];
  if (!segment) return "Miss";
  const prefix = point.row === 3 ? "T" : point.row === 2 ? "D" : "S";
  return `${prefix}${segment}`;
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

function isRoomReady(room: StoredRoom): boolean {
  const connectedHumans = room.players.filter((player) => !player.isBot && player.connected).length;
  if (isSoloGame(room.gameId) || room.opponent === "bot") return connectedHumans >= 1;
  return connectedHumans >= maxPlayersForGame(room.gameId);
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
    participantId: player.participantId ?? crypto.randomUUID(),
    name: player.name,
    connected: player.connected,
    ...(player.disconnectedAt ? { disconnectedAt: player.disconnectedAt } : {}),
    joinedAt: player.joinedAt
  };
}

function publicParticipantId(room: StoredRoom, guestToken: string): string {
  return room.players.find((player) => player.guestToken === guestToken)?.participantId
    ?? room.spectators.find((spectator) => spectator.guestToken === guestToken)?.participantId
    ?? "participant-unknown";
}

function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  if (typeof message.type !== "string") return false;

  switch (message.type) {
    case "join":
      return typeof message.guestToken === "string"
        && GUEST_TOKEN_PATTERN.test(message.guestToken)
        && typeof message.name === "string"
        && message.name.length <= 100;
    case "make_move":
      return isSafeGameMove(message.move)
        && (message.commandId === undefined
          || (typeof message.commandId === "string" && message.commandId.length >= 8 && message.commandId.length <= 100))
        && (message.expectedRevision === undefined
          || (Number.isInteger(message.expectedRevision) && Number(message.expectedRevision) >= 0));
    case "send_chat":
      return typeof message.body === "string" && message.body.length <= 500;
    case "send_reaction":
      return typeof message.emoji === "string" && message.emoji.length <= 16;
    case "request_rematch":
    case "request_undo":
    case "claim_seat":
      return true;
    case "switch_game":
      return typeof message.gameId === "string" && isGameId(message.gameId);
    case "set_board_variant":
      return typeof message.variant === "string" && ["mini", "classic", "wide", "party"].includes(message.variant);
    case "set_bot_difficulty":
      return typeof message.difficulty === "string" && isBotDifficulty(message.difficulty);
    case "set_bot_starts":
      return typeof message.botStarts === "boolean";
    default:
      return false;
  }
}

function isSafeGameMove(value: unknown): value is GameMove {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const move = value as Record<string, unknown>;
  if (!Number.isInteger(move.column) || Math.abs(Number(move.column)) > 1_000) return false;
  for (const field of ["row", "toRow", "toColumn"] as const) {
    if (move[field] !== undefined && (!Number.isInteger(move[field]) || Math.abs(Number(move[field])) > 1_000)) return false;
  }
  for (const field of ["power", "aim"] as const) {
    if (move[field] !== undefined && (typeof move[field] !== "number" || !Number.isFinite(move[field]) || Math.abs(move[field]) > 1_000)) return false;
  }
  if (move.word !== undefined && (typeof move.word !== "string" || move.word.length > 64)) return false;
  if (move.edge !== undefined && move.edge !== "h" && move.edge !== "v") return false;
  if (move.piece !== undefined && move.piece !== "X" && move.piece !== "O") return false;
  if (move.action !== undefined && move.action !== "roll" && move.action !== "bank") return false;
  if (move.color !== undefined && !["red", "yellow", "green", "blue"].includes(String(move.color))) return false;
  if (move.promotion !== undefined && !["q", "r", "b", "n"].includes(String(move.promotion))) return false;
  if (move.indices !== undefined && (!Array.isArray(move.indices)
    || move.indices.length !== 3
    || move.indices.some((index) => !Number.isInteger(index) || Math.abs(Number(index)) > 100))) return false;
  if (move.cardIds !== undefined && (!Array.isArray(move.cardIds)
    || move.cardIds.length !== 3
    || move.cardIds.some((id) => typeof id !== "string" || id.length > 40))) return false;
  return Object.keys(move).length <= 20;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function roomLabel(mark: PlayerMark, gameId: GameId): string {
  return getGameDefinition(gameId).playerNames[mark] ?? mark.toUpperCase();
}
