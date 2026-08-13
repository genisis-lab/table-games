import type {
  BoardPoint,
  BotDifficulty,
  BoardVariant,
  Cell,
  GameId,
  GameMove,
  GameMeta,
  PlayerMark,
  Winner
} from "./games";

export interface RoomPlayer {
  /** Stable public id. The reconnect credential is never included in snapshots. */
  participantId?: string;
  /** @deprecated Public snapshots contain a non-secret participant id here for old clients. */
  guestToken: string;
  name: string;
  mark: PlayerMark;
  connected: boolean;
  disconnectedAt?: number;
  joinedAt: number;
  isBot?: boolean;
}

export interface RoomSpectator {
  participantId?: string;
  /** @deprecated Public snapshots contain a non-secret participant id here for old clients. */
  guestToken: string;
  name: string;
  connected: boolean;
  disconnectedAt?: number;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  participantId?: string;
  /** @deprecated Public snapshots contain a non-secret participant id here for old clients. */
  guestToken: string;
  name: string;
  body: string;
  at: number;
}

export interface ReactionEvent {
  id: string;
  participantId?: string;
  /** @deprecated Public snapshots contain a non-secret participant id here for old clients. */
  guestToken: string;
  name: string;
  emoji: string;
  at: number;
}

export interface MoveRecord {
  id: string;
  player: PlayerMark;
  name: string;
  label: string;
  at: number;
}

export interface AppliedMove extends BoardPoint {
  player: PlayerMark;
  edge?: "h" | "v";
  toRow?: number;
  toColumn?: number;
  at: number;
}

export interface RoomSnapshot {
  roomId: string;
  gameId: GameId;
  boardVariant: BoardVariant;
  opponent: "friend" | "bot";
  botDifficulty: BotDifficulty;
  botStarts: boolean;
  phase?: "waiting" | "active" | "complete";
  readyAt?: number | null;
  players: RoomPlayer[];
  spectators: RoomSpectator[];
  board: Cell[][];
  turn: PlayerMark;
  winner: Winner;
  winningLine: BoardPoint[];
  moveCount: number;
  meta?: GameMeta;
  chat: ChatMessage[];
  reactionEvents: ReactionEvent[];
  moveHistory: MoveRecord[];
  rematchRequests: string[];
  undoRequests: string[];
  /** Monotonic game-state revision used to reject duplicate or stale moves. */
  revision?: number;
  /** Per-connection identity. Omitted from public HTTP snapshots. */
  you?: {
    participantId: string;
    role: "player" | "spectator";
    mark?: PlayerMark;
  } | null;
  createdAt: number;
  updatedAt: number;
}

export type ClientMessage =
  | { type: "join"; guestToken: string; name: string }
  | { type: "make_move"; move: GameMove; commandId?: string; expectedRevision?: number }
  | { type: "send_chat"; body: string }
  | { type: "send_reaction"; emoji: string }
  | { type: "request_rematch" }
  | { type: "request_undo" }
  | { type: "claim_seat" }
  | { type: "switch_game"; gameId: GameId }
  | { type: "set_board_variant"; variant: BoardVariant }
  | { type: "set_bot_difficulty"; difficulty: BotDifficulty }
  | { type: "set_bot_starts"; botStarts: boolean };

export type ServerMessage =
  | { type: "room_snapshot"; room: RoomSnapshot }
  | { type: "move_applied"; room: RoomSnapshot; move: AppliedMove }
  | { type: "chat_added"; room: RoomSnapshot; chat: ChatMessage }
  | { type: "reaction_added"; room: RoomSnapshot; reaction: ReactionEvent }
  | { type: "presence_changed"; room: RoomSnapshot }
  | { type: "game_over"; room: RoomSnapshot; winner: Winner }
  | { type: "error"; reason: string };

export const DEFAULT_CHAT = [
  "your move",
  "that drop was loud",
  "gg incoming"
];

export const REACTIONS = ["😂", "🔥", "⭐", "💥", "🎯", "🫶", "😮", "🏆"];
