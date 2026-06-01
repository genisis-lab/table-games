import { DurableObject } from "cloudflare:workers";
import {
  applyGameMove,
  chooseBotMove,
  createGameState,
  getGameDefinition,
  isBotDifficulty,
  isGameId,
  supportsFriendMode,
  type BotDifficulty,
  type GameId,
  type GameMove,
  type PlayerMark
} from "../src/shared/games";
import type {
  ChatMessage,
  ClientMessage,
  ReactionEvent,
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
  opponent: "friend" | "bot";
  botDifficulty: BotDifficulty;
  players: RoomPlayer[];
  spectators: RoomSpectator[];
  game: ReturnType<typeof createGameState>;
  chat: ChatMessage[];
  reactionEvents: ReactionEvent[];
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
      };
      if (!body.gameId || !isGameId(body.gameId)) {
        return Response.json({ error: "Unknown game." }, { status: 400 });
      }

      const opponent = supportsFriendMode(body.gameId)
        ? body.opponent === "bot" ? "bot" : "friend"
        : "bot";
      const room = await this.loadRoom(
        roomId,
        body.gameId,
        opponent,
        body.botDifficulty && isBotDifficulty(body.botDifficulty) ? body.botDifficulty : "ruthless"
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
      case "switch_game":
        await this.handleSwitchGame(ws, room, attachment.guestToken, clientMessage.gameId);
        return;
      case "set_bot_difficulty":
        await this.handleSetBotDifficulty(ws, room, attachment.guestToken, clientMessage.difficulty);
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
      this.broadcast({ type: "presence_changed", room: this.snapshot(room) });
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

    const snapshot = this.snapshot(room);
    this.send(ws, { type: "room_snapshot", room: snapshot });
    this.broadcast({ type: "presence_changed", room: snapshot });
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

    room.game = result.state;
    room.updatedAt = Date.now();
    await this.saveRoom(room);

    const snapshot = this.snapshot(room);
    this.broadcast({
      type: "move_applied",
      room: snapshot,
      move: { ...result.point, player: player.mark }
    });

    if (snapshot.winner) {
      this.broadcast({ type: "game_over", room: snapshot, winner: snapshot.winner });
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

    this.broadcast({ type: "chat_added", room: this.snapshot(room), chat });
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

    this.broadcast({ type: "reaction_added", room: this.snapshot(room), reaction });
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

    room.game = createGameState(room.gameId);
    room.updatedAt = Date.now();
    await this.saveRoom(room);
    this.broadcast({ type: "room_snapshot", room: this.snapshot(room) });
    await this.maybePlayBot(room);
  }

  private async handleSwitchGame(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined,
    gameId: GameId
  ): Promise<void> {
    if (!this.findPlayer(room, guestToken)) {
      this.send(ws, { type: "error", reason: "Only seated players can switch games." });
      return;
    }

    if (!isGameId(gameId)) {
      this.send(ws, { type: "error", reason: "Unknown game." });
      return;
    }

    if (!supportsFriendMode(gameId) && room.opponent !== "bot") {
      room.opponent = "bot";
      const now = Date.now();
      const existingBot = room.players.find((roomPlayer) => roomPlayer.isBot);
      if (existingBot) {
        existingBot.mark = "p2";
        existingBot.connected = true;
      } else {
        const displaced = room.players.find((roomPlayer) => roomPlayer.mark === "p2" && !roomPlayer.isBot);
        if (displaced) {
          room.spectators.push({
            guestToken: displaced.guestToken,
            name: displaced.name,
            connected: displaced.connected,
            joinedAt: displaced.joinedAt
          });
          room.players = room.players.filter((roomPlayer) => roomPlayer !== displaced);
        }
        room.players.push(createBotPlayer(room.roomId, now));
      }
    }

    room.gameId = gameId;
    room.game = createGameState(gameId);
    room.updatedAt = Date.now();
    await this.saveRoom(room);
    this.broadcast({ type: "room_snapshot", room: this.snapshot(room) });
    await this.maybePlayBot(room);
  }

  private async handleSetBotDifficulty(
    ws: WebSocket,
    room: StoredRoom,
    guestToken: string | undefined,
    difficulty: BotDifficulty
  ): Promise<void> {
    if (!this.findPlayer(room, guestToken)) {
      this.send(ws, { type: "error", reason: "Only seated players can adjust the bot." });
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
    this.broadcast({ type: "room_snapshot", room: this.snapshot(room) });
  }

  private async maybePlayBot(room: StoredRoom): Promise<void> {
    if (room.opponent !== "bot" || room.game.winner) return;

    const bot = room.players.find((player) => player.isBot && player.mark === room.game.turn);
    if (!bot) return;

    const move = chooseBotMove(room.game, bot.mark, room.botDifficulty);
    if (!move) return;

    const result = applyGameMove(room.game, bot.mark, move);
    if (!result.ok) return;

    room.game = result.state;
    room.updatedAt = Date.now();
    await this.saveRoom(room);

    const snapshot = this.snapshot(room);
    this.broadcast({
      type: "move_applied",
      room: snapshot,
      move: { ...result.point, player: bot.mark }
    });

    if (snapshot.winner) {
      this.broadcast({ type: "game_over", room: snapshot, winner: snapshot.winner });
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
    botDifficulty: BotDifficulty = "ruthless"
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
      opponent,
      botDifficulty,
      players: opponent === "bot" ? [createBotPlayer(roomId, now)] : [],
      spectators: [],
      game: createGameState(gameId),
      chat: [],
      reactionEvents: [],
      createdAt: now,
      updatedAt: now
    };
    return this.room;
  }

  private async saveRoom(room: StoredRoom): Promise<void> {
    this.room = room;
    await this.ctx.storage.put(ROOM_KEY, room);
  }

  private snapshot(room: StoredRoom): RoomSnapshot {
    return {
      roomId: room.roomId,
      gameId: room.gameId,
      opponent: room.opponent,
      botDifficulty: room.botDifficulty,
      players: [...room.players].sort((a, b) => a.mark.localeCompare(b.mark)),
      spectators: room.spectators,
      board: room.game.board,
      turn: room.game.turn,
      winner: room.game.winner,
      winningLine: room.game.winningLine,
      moveCount: room.game.moveCount,
      meta: room.game.meta,
      chat: room.chat,
      reactionEvents: room.reactionEvents,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    };
  }

  private ensureRoomShape(room: StoredRoom, roomId: string): StoredRoom {
    room.opponent ??= "friend";
    room.botDifficulty ??= "ruthless";

    if (room.opponent === "bot" && !room.players.some((player) => player.isBot)) {
      room.players.push(createBotPlayer(roomId, Date.now()));
    }

    return room;
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

function createBotPlayer(roomId: string, joinedAt: number): RoomPlayer {
  return {
    guestToken: `bot:${roomId}`,
    name: BOT_NAME,
    mark: "p2",
    connected: true,
    joinedAt,
    isBot: true
  };
}

function availablePlayerMark(room: StoredRoom): PlayerMark | null {
  if (!room.players.some((player) => player.mark === "p1")) return "p1";
  if (!room.players.some((player) => player.mark === "p2")) return "p2";
  return null;
}

export function roomLabel(mark: PlayerMark, gameId: GameId): string {
  return getGameDefinition(gameId).playerNames[mark];
}
