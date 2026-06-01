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
  guestToken: string;
  name: string;
  mark: PlayerMark;
  connected: boolean;
  joinedAt: number;
  isBot?: boolean;
}

export interface RoomSpectator {
  guestToken: string;
  name: string;
  connected: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  guestToken: string;
  name: string;
  body: string;
  at: number;
}

export interface ReactionEvent {
  id: string;
  guestToken: string;
  name: string;
  emoji: string;
  at: number;
}

export interface RoomSnapshot {
  roomId: string;
  gameId: GameId;
  boardVariant: BoardVariant;
  opponent: "friend" | "bot";
  botDifficulty: BotDifficulty;
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
  createdAt: number;
  updatedAt: number;
}

export type ClientMessage =
  | { type: "join"; guestToken: string; name: string }
  | { type: "make_move"; move: GameMove }
  | { type: "send_chat"; body: string }
  | { type: "send_reaction"; emoji: string }
  | { type: "request_rematch" }
  | { type: "switch_game"; gameId: GameId }
  | { type: "set_board_variant"; variant: BoardVariant }
  | { type: "set_bot_difficulty"; difficulty: BotDifficulty };

export type ServerMessage =
  | { type: "room_snapshot"; room: RoomSnapshot }
  | { type: "move_applied"; room: RoomSnapshot; move: BoardPoint & { player: PlayerMark } }
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
