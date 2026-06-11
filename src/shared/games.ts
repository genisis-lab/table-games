import {
  applyDominoIntent,
  chooseDominoBotMove,
  createDominoMeta as createDominoTableMeta,
  getDominoLegalMoves,
  maskDominoMetaForPlayer,
  normalizeDominoMeta
} from "../games/domino/engine";
import type { DominoMeta, DominoPlayerMark, DominoTile } from "../games/domino/engine";
import {
  applyCupPongIntent,
  chooseCupPongBotMove,
  createCupPongMeta as createCupPongTableMeta,
  getCupPongLegalMoves,
  normalizeCupPongMeta
} from "../games/cup-pong/engine";
import type { CupPongMeta, CupPongPlayerMark } from "../games/cup-pong/engine";

export type { DominoMeta, DominoTile } from "../games/domino/engine";
export type { CupPongMeta } from "../games/cup-pong/engine";
export { isCupPongReRackAvailable } from "../games/cup-pong/engine";

export type GameId =
  | "four-in-a-row"
  | "tic-tac-toe"
  | "gomoku"
  | "ultimate-tic-tac-toe"
  | "dots-and-boxes"
  | "reversi"
  | "checkers"
  | "battleship"
  | "mancala"
  | "hex"
  | "nine-mens-morris"
  | "last-card"
  | "darts"
  | "word-hunt"
  | "cup-pong"
  | "dominoes"
  | "flappy-bird"
  | "snake"
  | "twenty-forty-eight";
export type PlayerMark = "p1" | "p2" | "p3" | "p4";
export type Winner = PlayerMark | "draw" | null;
export type Cell = PlayerMark | null;
export type BotDifficulty = "casual" | "sharp" | "ruthless";
export type BoardVariant = "mini" | "classic" | "wide" | "party";

export interface BoardPoint {
  row: number;
  column: number;
}

export interface GameMove {
  row?: number;
  column: number;
  toRow?: number;
  toColumn?: number;
  edge?: "h" | "v";
  word?: string;
  power?: number;
  aim?: number;
}

export interface DotsMeta {
  size: number;
  hEdges: boolean[][];
  vEdges: boolean[][];
  scores: Record<PlayerMark, number>;
}

export interface DartsThrow {
  player: PlayerMark;
  label: string;
  score: number;
}

export interface DartsTarget {
  label: string;
  value: number;
  multiplier: number;
}

export interface DartsMeta {
  targetScore: number;
  scores: Record<PlayerMark, number>;
  dartsLeft: number;
  turnScore: number;
  throws: DartsThrow[];
}

export interface WordHuntMeta {
  size: number;
  letters: string[][];
  words: string[];
  found: Record<PlayerMark, string[]>;
  scores: Record<PlayerMark, number>;
  seed: string;
  roundStartedAt: number;
  durationMs: number;
}

export interface UltimateMeta {
  localWinners: Winner[];
  activeBoard: number | null;
}

export interface CheckersMeta {
  kings: string[];
  mustContinueFrom?: string | null;
}

export interface BattleshipShot {
  row: number;
  column: number;
}

export interface BattleshipShip {
  id: "carrier" | "battleship" | "cruiser" | "submarine" | "patrol";
  name: string;
  size: number;
  orientation: "horizontal" | "vertical";
  cells: BattleshipShot[];
}

export interface BattleshipMeta {
  botFleet: BattleshipShip[];
  playerFleet: BattleshipShip[];
  botShips: BattleshipShot[];
  playerShips: BattleshipShot[];
  humanShots: Record<string, "hit" | "miss">;
  botShots: Record<string, "hit" | "miss">;
}

export interface MancalaMeta {
  pits: Record<PlayerMark, number[]>;
  stores: Record<PlayerMark, number>;
}

export interface MorrisMeta {
  placed: Record<PlayerMark, number>;
  removed: Record<PlayerMark, number>;
  pendingRemoval?: PlayerMark | null;
}

export type LastCardColor = "red" | "yellow" | "green" | "blue" | "wild";
type LastCardActiveColor = Exclude<LastCardColor, "wild">;
export type LastCardRank =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild4";

export interface LastCardCard {
  id: string;
  color: LastCardColor;
  rank: LastCardRank;
}

export interface LastCardMeta {
  deck: LastCardCard[];
  deckCount: number;
  discard: LastCardCard[];
  hands: Record<PlayerMark, LastCardCard[]>;
  handCounts: Record<PlayerMark, number>;
  currentColor: LastCardActiveColor;
  lastDraw?: { player: PlayerMark; count: number; playable?: boolean };
  lastAction?: LastCardRank;
}

export interface GameMeta {
  ultimate?: UltimateMeta;
  dots?: DotsMeta;
  checkers?: CheckersMeta;
  battleship?: BattleshipMeta;
  mancala?: MancalaMeta;
  morris?: MorrisMeta;
  lastCard?: LastCardMeta;
  darts?: DartsMeta;
  wordHunt?: WordHuntMeta;
  cupPong?: CupPongMeta;
  dominoes?: DominoMeta;
}

export interface GameDefinition {
  id: GameId;
  name: string;
  rows: number;
  columns: number;
  connectLength: number;
  moveMode: "drop-column" | "place-cell" | "custom";
  playerNames: Partial<Record<PlayerMark, string>>;
  supportsFriend: boolean;
}

export interface GameState {
  gameId: GameId;
  boardVariant: BoardVariant;
  board: Cell[][];
  turn: PlayerMark;
  winner: Winner;
  winningLine: BoardPoint[];
  moveCount: number;
  meta?: GameMeta;
}

export type MoveResult =
  | { ok: true; state: GameState; point: BoardPoint }
  | { ok: false; state: GameState; reason: string };

export interface BoardVariantOption {
  id: BoardVariant;
  label: string;
  detail: string;
}

const DEFINITIONS: Record<GameId, GameDefinition> = {
  "four-in-a-row": {
    id: "four-in-a-row",
    name: "Four in a Row",
    rows: 6,
    columns: 7,
    connectLength: 4,
    moveMode: "drop-column",
    playerNames: { p1: "Red", p2: "Yellow" },
    supportsFriend: true
  },
  "tic-tac-toe": {
    id: "tic-tac-toe",
    name: "Tic Tac Toe",
    rows: 3,
    columns: 3,
    connectLength: 3,
    moveMode: "place-cell",
    playerNames: { p1: "X", p2: "O" },
    supportsFriend: true
  },
  gomoku: {
    id: "gomoku",
    name: "Gomoku",
    rows: 15,
    columns: 15,
    connectLength: 5,
    moveMode: "place-cell",
    playerNames: { p1: "Black", p2: "White" },
    supportsFriend: true
  },
  "ultimate-tic-tac-toe": {
    id: "ultimate-tic-tac-toe",
    name: "Ultimate Tic Tac Toe",
    rows: 9,
    columns: 9,
    connectLength: 3,
    moveMode: "custom",
    playerNames: { p1: "X", p2: "O" },
    supportsFriend: true
  },
  "dots-and-boxes": {
    id: "dots-and-boxes",
    name: "Dots and Boxes",
    rows: 4,
    columns: 4,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Blue", p2: "Red" },
    supportsFriend: true
  },
  reversi: {
    id: "reversi",
    name: "Reversi",
    rows: 8,
    columns: 8,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Black", p2: "White" },
    supportsFriend: true
  },
  checkers: {
    id: "checkers",
    name: "Checkers",
    rows: 8,
    columns: 8,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Red", p2: "Black" },
    supportsFriend: true
  },
  battleship: {
    id: "battleship",
    name: "Sea Battle",
    rows: 10,
    columns: 10,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Captain", p2: "Fleet Bot" },
    supportsFriend: false
  },
  mancala: {
    id: "mancala",
    name: "Mancala",
    rows: 2,
    columns: 6,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "South", p2: "North" },
    supportsFriend: true
  },
  hex: {
    id: "hex",
    name: "Hex",
    rows: 11,
    columns: 11,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "East-West", p2: "North-South" },
    supportsFriend: true
  },
  "nine-mens-morris": {
    id: "nine-mens-morris",
    name: "Nine Men's Morris",
    rows: 7,
    columns: 7,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "White", p2: "Black" },
    supportsFriend: true
  },
  "last-card": {
    id: "last-card",
    name: "Color Clash",
    rows: 1,
    columns: 1,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Player 1", p2: "Player 2" },
    supportsFriend: true
  },
  darts: {
    id: "darts",
    name: "Darts",
    rows: 1,
    columns: 1,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Thrower 1", p2: "Thrower 2" },
    supportsFriend: true
  },
  "word-hunt": {
    id: "word-hunt",
    name: "Word Hunt",
    rows: 4,
    columns: 4,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Finder 1", p2: "Finder 2" },
    supportsFriend: true
  },
  "cup-pong": {
    id: "cup-pong",
    name: "Cup Pong",
    rows: 1,
    columns: 1,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Blue Cups", p2: "Red Cups" },
    supportsFriend: true
  },
  dominoes: {
    id: "dominoes",
    name: "Dominoes",
    rows: 1,
    columns: 1,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Seat 1", p2: "Seat 2", p3: "Seat 3", p4: "Seat 4" },
    supportsFriend: true
  },
  "flappy-bird": {
    id: "flappy-bird",
    name: "Pipe Dash",
    rows: 1,
    columns: 1,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Bird", p2: "Pipes" },
    supportsFriend: false
  },
  snake: {
    id: "snake",
    name: "Snake",
    rows: 1,
    columns: 1,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Snake", p2: "Wall" },
    supportsFriend: false
  },
  "twenty-forty-eight": {
    id: "twenty-forty-eight",
    name: "2048",
    rows: 1,
    columns: 1,
    connectLength: 0,
    moveMode: "custom",
    playerNames: { p1: "Tiles", p2: "Board" },
    supportsFriend: false
  }
};

const BOARD_VARIANTS: Record<GameId, BoardVariantOption[]> = {
  "four-in-a-row": [{ id: "classic", label: "Classic", detail: "7x6" }],
  "tic-tac-toe": [
    { id: "classic", label: "3x3", detail: "connect 3" },
    { id: "wide", label: "5x5", detail: "connect 4" },
    { id: "party", label: "7x7", detail: "connect 5" }
  ],
  gomoku: [{ id: "classic", label: "Classic", detail: "15x15" }],
  "ultimate-tic-tac-toe": [
    { id: "classic", label: "3x3", detail: "9 boards" },
    { id: "wide", label: "4x4", detail: "16 boards" }
  ],
  "dots-and-boxes": [
    { id: "mini", label: "3x3", detail: "quick score race" },
    { id: "classic", label: "4x4", detail: "quick boxes" },
    { id: "wide", label: "5x5", detail: "longer table" },
    { id: "party", label: "6x6", detail: "big scramble" }
  ],
  reversi: [{ id: "classic", label: "Classic", detail: "8x8" }],
  checkers: [{ id: "classic", label: "Classic", detail: "8x8" }],
  battleship: [{ id: "classic", label: "Classic", detail: "10x10" }],
  mancala: [{ id: "classic", label: "Classic", detail: "6 pits" }],
  hex: [{ id: "classic", label: "Classic", detail: "11x11" }],
  "nine-mens-morris": [{ id: "classic", label: "Classic", detail: "24 points" }],
  "last-card": [{ id: "classic", label: "Classic", detail: "7-card hands" }],
  darts: [
    { id: "classic", label: "301", detail: "race to zero" },
    { id: "wide", label: "501", detail: "longer checkout" }
  ],
  "word-hunt": [
    { id: "classic", label: "4x4", detail: "quick board" },
    { id: "wide", label: "5x5", detail: "bigger hunt" }
  ],
  "cup-pong": [
    { id: "classic", label: "6 cups", detail: "quick rack" },
    { id: "party", label: "10 cups", detail: "full rack" }
  ],
  dominoes: [
    { id: "classic", label: "Teams 100", detail: "2v2 block dominoes" },
    { id: "wide", label: "FFA 100", detail: "every seat for itself" },
    { id: "party", label: "Teams 150", detail: "longer 2v2 match" }
  ],
  "flappy-bird": [{ id: "classic", label: "Classic", detail: "solo run" }],
  snake: [{ id: "classic", label: "Classic", detail: "solo chase" }],
  "twenty-forty-eight": [{ id: "classic", label: "Classic", detail: "solo merge" }]
};

const DIRECTIONS = [
  { row: 0, column: 1 },
  { row: 1, column: 0 },
  { row: 1, column: 1 },
  { row: 1, column: -1 }
] as const;

const HEX_DIRECTIONS = [
  { row: -1, column: 0 },
  { row: -1, column: 1 },
  { row: 0, column: -1 },
  { row: 0, column: 1 },
  { row: 1, column: -1 },
  { row: 1, column: 0 }
] as const;

const MORRIS_POINTS = new Set([
  "0,0", "0,3", "0,6",
  "1,1", "1,3", "1,5",
  "2,2", "2,3", "2,4",
  "3,0", "3,1", "3,2", "3,4", "3,5", "3,6",
  "4,2", "4,3", "4,4",
  "5,1", "5,3", "5,5",
  "6,0", "6,3", "6,6"
]);

const MORRIS_MILLS = [
  ["0,0", "0,3", "0,6"], ["1,1", "1,3", "1,5"], ["2,2", "2,3", "2,4"],
  ["3,0", "3,1", "3,2"], ["3,4", "3,5", "3,6"], ["4,2", "4,3", "4,4"],
  ["5,1", "5,3", "5,5"], ["6,0", "6,3", "6,6"], ["0,0", "3,0", "6,0"],
  ["1,1", "3,1", "5,1"], ["2,2", "3,2", "4,2"], ["0,3", "1,3", "2,3"],
  ["4,3", "5,3", "6,3"], ["2,4", "3,4", "4,4"], ["1,5", "3,5", "5,5"],
  ["0,6", "3,6", "6,6"]
];

const MORRIS_NEIGHBORS: Record<string, string[]> = {
  "0,0": ["0,3", "3,0"], "0,3": ["0,0", "0,6", "1,3"], "0,6": ["0,3", "3,6"],
  "1,1": ["1,3", "3,1"], "1,3": ["0,3", "1,1", "1,5", "2,3"], "1,5": ["1,3", "3,5"],
  "2,2": ["2,3", "3,2"], "2,3": ["1,3", "2,2", "2,4"], "2,4": ["2,3", "3,4"],
  "3,0": ["0,0", "3,1", "6,0"], "3,1": ["1,1", "3,0", "3,2", "5,1"],
  "3,2": ["2,2", "3,1", "4,2"], "3,4": ["2,4", "3,5", "4,4"],
  "3,5": ["1,5", "3,4", "3,6", "5,5"], "3,6": ["0,6", "3,5", "6,6"],
  "4,2": ["3,2", "4,3"], "4,3": ["4,2", "4,4", "5,3"], "4,4": ["3,4", "4,3"],
  "5,1": ["3,1", "5,3"], "5,3": ["4,3", "5,1", "5,5", "6,3"], "5,5": ["3,5", "5,3"],
  "6,0": ["3,0", "6,3"], "6,3": ["5,3", "6,0", "6,6"], "6,6": ["3,6", "6,3"]
};

const LAST_CARD_COLORS: LastCardActiveColor[] = ["red", "yellow", "green", "blue"];
const LAST_CARD_NUMBER_RANKS: LastCardRank[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const LAST_CARD_ACTION_RANKS: LastCardRank[] = ["skip", "reverse", "draw2"];
const LAST_CARD_WILD_RANKS: LastCardRank[] = ["wild", "wild4"];
const LAST_CARD_DRAW_MOVE = -1;
const LAST_CARD_HAND_SIZE = 7;
const DARTS_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;
const DARTS_BULL_INDEX = 20;
const DARTS_MISS_COLUMN = -1;
const WORD_HUNT_BANK = [
  "SPARK", "TABLE", "BOARD", "TOKEN", "MATCH", "STONE", "CROWN", "ARROW", "QUEST", "LUCK",
  "RACK", "CUP", "DART", "BIRD", "GRID", "LINE", "SWAP", "FIRE", "CHAT", "SCORE",
  "PLAY", "TURN", "WILD", "HIT", "SHIP", "DOMINO", "PONG", "WORD", "HUNT", "NIGHT",
  "PARTY", "DUEL", "BOT", "WIN", "MOVE", "DROP", "FLIP", "JUMP", "KING", "FIVE",
  "FOUR", "THREE", "RUSH", "RING", "BULL", "CLOSE", "STACK", "BRIDGE", "MILL", "SEAT",
  "BOWL", "POOL", "GREEN", "LANE", "AIM", "BANK", "SINK", "TIMER", "RACE", "FIND",
  "FAST", "CLUB", "CUE", "BALL", "GOLF", "PUTT", "HOLE", "PIN", "ROLL", "ANGLE"
];
const WORD_HUNT_CLASSIC_DURATION_MS = 90_000;
const WORD_HUNT_WIDE_DURATION_MS = 120_000;
const PLAYER_ORDER: PlayerMark[] = ["p1", "p2", "p3", "p4"];

const HIDDEN_GAME_IDS = new Set<GameId>(["snake"]);

export const GAME_IDS = (Object.keys(DEFINITIONS) as GameId[]).filter((gameId) => !HIDDEN_GAME_IDS.has(gameId));

export function getGameDefinition(gameId: GameId): GameDefinition {
  return DEFINITIONS[gameId];
}

export function playerNameFor(gameId: GameId, mark: PlayerMark): string {
  return getGameDefinition(gameId).playerNames[mark] ?? mark.toUpperCase();
}

export function maxPlayersForGame(gameId: GameId): number {
  if (isSoloGame(gameId)) return 1;
  return gameId === "dominoes" ? 4 : 2;
}

export function canBotStart(gameId: GameId): boolean {
  return !isSoloGame(gameId) && gameId !== "battleship";
}

export function isGameId(value: string): value is GameId {
  return value in DEFINITIONS;
}

export function isBotDifficulty(value: string): value is BotDifficulty {
  return value === "casual" || value === "sharp" || value === "ruthless";
}

export function supportsFriendMode(gameId: GameId): boolean {
  return getGameDefinition(gameId).supportsFriend;
}

export function isSoloGame(gameId: GameId): boolean {
  return gameId === "flappy-bird" || gameId === "snake" || gameId === "twenty-forty-eight";
}

export function getBoardVariantOptions(gameId: GameId): BoardVariantOption[] {
  return BOARD_VARIANTS[gameId];
}

export function isBoardVariantForGame(gameId: GameId, variant: string): variant is BoardVariant {
  return BOARD_VARIANTS[gameId].some((option) => option.id === variant);
}

export function getDefaultBoardVariant(gameId: GameId): BoardVariant {
  return BOARD_VARIANTS[gameId][0].id;
}

export function createGameState(gameId: GameId, boardVariant: BoardVariant = getDefaultBoardVariant(gameId)): GameState {
  const definition = getGameDefinition(gameId);
  const dimensions = dimensionsFor(gameId, boardVariant);
  const board = Array.from({ length: dimensions.rows }, () =>
    Array.from<Cell>({ length: dimensions.columns }).fill(null)
  );

  if (gameId === "reversi") {
    board[3][3] = "p2";
    board[3][4] = "p1";
    board[4][3] = "p1";
    board[4][4] = "p2";
  }

  if (gameId === "checkers") {
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        if ((row + column) % 2 === 1) board[row][column] = "p2";
      }
    }
    for (let row = 5; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        if ((row + column) % 2 === 1) board[row][column] = "p1";
      }
    }
  }

  return {
    gameId,
    boardVariant,
    board,
    turn: "p1",
    winner: null,
    winningLine: [],
    moveCount: 0,
    meta: createMeta(gameId, boardVariant)
  };
}

export function finalizeGameState(state: GameState, now = Date.now()): GameState {
  if (state.winner) return state;
  if (state.gameId !== "word-hunt") return state;

  const clonedMeta = cloneMeta(state);
  const meta = normalizeWordHuntMeta(clonedMeta.wordHunt);
  if (!meta || wordHuntTimeRemaining(meta, now) > 0) return state;
  const finalizedMeta = { ...clonedMeta, wordHunt: meta };
  const finalizedState = { ...state, meta: finalizedMeta };

  return {
    ...state,
    winner: highestScoreWinner(meta.scores, wordHuntActiveMarks(finalizedState)),
    winningLine: [],
    meta: finalizedMeta
  };
}

export function applyGameMove(
  state: GameState,
  player: PlayerMark,
  move: GameMove
): MoveResult {
  if (state.winner) return { ok: false, state, reason: "This game is already over." };
  if (player !== state.turn && state.gameId !== "word-hunt") return { ok: false, state, reason: "It is not your turn." };

  switch (state.gameId) {
    case "ultimate-tic-tac-toe":
      return applyUltimateMove(state, player, move);
    case "dots-and-boxes":
      return applyDotsMove(state, player, move);
    case "reversi":
      return applyReversiMove(state, player, move);
    case "checkers":
      return applyCheckersMove(state, player, move);
    case "battleship":
      return applyBattleshipMove(state, player, move);
    case "mancala":
      return applyMancalaMove(state, player, move);
    case "hex":
      return applyHexMove(state, player, move);
    case "nine-mens-morris":
      return applyMorrisMove(state, player, move);
    case "last-card":
      return applyLastCardMove(state, player, move);
    case "darts":
      return applyDartsMove(state, player, move);
    case "word-hunt":
      return applyWordHuntMove(state, player, move);
    case "cup-pong":
      return applyCupPongMove(state, player, move);
    case "dominoes":
      return applyDominoMove(state, player, move);
    case "flappy-bird":
    case "snake":
    case "twenty-forty-eight":
      return { ok: false, state, reason: `${getGameDefinition(state.gameId).name} is a solo arcade run.` };
    default:
      return applyConnectMove(state, player, move);
  }
}

export function getLegalMoves(state: GameState): GameMove[] {
  if (state.winner) return [];

  switch (state.gameId) {
    case "ultimate-tic-tac-toe":
      return getUltimateMoves(state);
    case "dots-and-boxes":
      return getDotsMoves(state);
    case "reversi":
      return getReversiMoves(state, state.turn);
    case "checkers":
      return getCheckersMoves(state, state.turn);
    case "battleship":
      return getBattleshipMoves(state, state.turn);
    case "mancala":
      return getMancalaMoves(state, state.turn);
    case "hex":
      return getEmptyCellMoves(state);
    case "nine-mens-morris":
      return getMorrisMoves(state, state.turn);
    case "last-card":
      return getLastCardMoves(state, state.turn);
    case "darts":
      return getDartsMoves(state);
    case "word-hunt":
      return getWordHuntMoves(state, state.turn);
    case "cup-pong":
      return getCupPongMoves(state, state.turn);
    case "dominoes":
      return getDominoMoves(state, state.turn);
    case "flappy-bird":
    case "snake":
    case "twenty-forty-eight":
      return [];
    default:
      return getConnectMoves(state);
  }
}

export function chooseBotMove(
  state: GameState,
  player: PlayerMark,
  difficulty: BotDifficulty = "ruthless"
): GameMove | null {
  const legalMoves = getLegalMoves({ ...state, turn: player });
  if (legalMoves.length === 0 || state.winner) return null;

  if (state.gameId === "last-card") {
    return chooseLastCardMove({ ...state, turn: player }, player, legalMoves, difficulty);
  }

  if (state.gameId === "darts") {
    return chooseDartsMove({ ...state, turn: player }, player, legalMoves, difficulty);
  }

  if (state.gameId === "word-hunt") {
    return chooseWordHuntMove({ ...state, turn: player }, player, legalMoves, difficulty);
  }

  if (state.gameId === "cup-pong") {
    return chooseCupPongMove({ ...state, turn: player }, player, legalMoves, difficulty);
  }

  if (state.gameId === "dominoes") {
    return chooseDominoMove({ ...state, turn: player }, player, legalMoves, difficulty);
  }

  const winningMove = findImmediateWinningMove(state, player, legalMoves);
  if (winningMove) return winningMove;

  const opponent = otherPlayer(player);
  const blockingMove = findImmediateWinningMove({ ...state, turn: opponent }, opponent, legalMoves);
  if (blockingMove && state.gameId !== "battleship") return blockingMove;

  if (state.gameId === "four-in-a-row") {
    return chooseFourInARowMove({ ...state, turn: player }, player, legalMoves, difficulty);
  }

  if (state.gameId === "dots-and-boxes") {
    return chooseDotsMove({ ...state, turn: player }, legalMoves, difficulty);
  }

  if (state.gameId === "checkers") {
    return chooseCheckersMove({ ...state, turn: player }, player, legalMoves, difficulty);
  }

  if (state.gameId === "tic-tac-toe" && difficulty === "ruthless") {
    return state.board.length === 3
      ? chooseByMinimax(state, player, legalMoves, 9)
      : chooseBySearch({ ...state, turn: player }, player, legalMoves, 2);
  }

  if (state.gameId === "battleship") {
    return chooseBattleshipMove({ ...state, turn: player }, player, legalMoves, difficulty);
  }

  const depth = legalMoves.length > 90
    ? 1
    : difficulty === "casual"
    ? 1
    : difficulty === "sharp"
      ? 2
      : state.gameId === "gomoku" || state.gameId === "ultimate-tic-tac-toe"
        ? 2
        : 3;
  return chooseBySearch({ ...state, turn: player }, player, legalMoves, depth);
}

function dimensionsFor(gameId: GameId, variant: BoardVariant): { rows: number; columns: number } {
  if (gameId === "tic-tac-toe") {
    const size = variant === "party" ? 7 : variant === "wide" ? 5 : 3;
    return { rows: size, columns: size };
  }
  if (gameId === "ultimate-tic-tac-toe") {
    const localSize = variant === "wide" ? 4 : 3;
    const size = localSize * localSize;
    return { rows: size, columns: size };
  }
  if (gameId === "dots-and-boxes") {
    const size = variant === "party" ? 6 : variant === "wide" ? 5 : variant === "mini" ? 3 : 4;
    return { rows: size, columns: size };
  }
  if (gameId === "word-hunt") {
    const size = variant === "wide" ? 5 : 4;
    return { rows: size, columns: size };
  }
  const definition = getGameDefinition(gameId);
  return { rows: definition.rows, columns: definition.columns };
}

function connectLengthFor(state: GameState): number {
  if (state.gameId === "tic-tac-toe") {
    if (state.board.length >= 7) return 5;
    if (state.board.length >= 5) return 4;
    return 3;
  }
  return getGameDefinition(state.gameId).connectLength;
}

function ultimateLocalSize(state: GameState): number {
  return Math.sqrt(state.board.length);
}

function createMeta(gameId: GameId, variant: BoardVariant): GameMeta | undefined {
  if (gameId === "ultimate-tic-tac-toe") {
    const localSize = variant === "wide" ? 4 : 3;
    return {
      ultimate: {
        localWinners: Array.from<Winner>({ length: localSize * localSize }).fill(null),
        activeBoard: null
      }
    };
  }

  if (gameId === "dots-and-boxes") {
    const size = variant === "party" ? 6 : variant === "wide" ? 5 : variant === "mini" ? 3 : 4;
    return {
      dots: {
        size,
        hEdges: Array.from({ length: size + 1 }, () => Array.from<boolean>({ length: size }).fill(false)),
        vEdges: Array.from({ length: size }, () => Array.from<boolean>({ length: size + 1 }).fill(false)),
        scores: emptyPlayerNumbers()
      }
    };
  }

  if (gameId === "checkers") return { checkers: { kings: [] } };

  if (gameId === "battleship") {
    const botFleet = makeFleetShips();
    const playerFleet = makeFleetShips();
    return {
      battleship: {
        botFleet,
        playerFleet,
        botShips: flattenFleet(botFleet),
        playerShips: flattenFleet(playerFleet),
        humanShots: {},
        botShots: {}
      }
    };
  }

  if (gameId === "mancala") {
    return {
      mancala: {
        pits: { p1: [4, 4, 4, 4, 4, 4], p2: [4, 4, 4, 4, 4, 4], p3: [], p4: [] },
        stores: emptyPlayerNumbers()
      }
    };
  }

  if (gameId === "nine-mens-morris") {
    return { morris: { placed: emptyPlayerNumbers(), removed: emptyPlayerNumbers(), pendingRemoval: null } };
  }

  if (gameId === "last-card") return { lastCard: createLastCardMeta() };

  if (gameId === "darts") return { darts: createDartsMeta(variant) };

  if (gameId === "word-hunt") return { wordHunt: createWordHuntMeta(variant) };

  if (gameId === "cup-pong") return { cupPong: createCupPongMeta(variant) };

  if (gameId === "dominoes") return { dominoes: createDominoTableMeta(variant) };

  return undefined;
}

function applyConnectMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const definition = getGameDefinition(state.gameId);
  const target = resolveTarget(state, move);
  if (!target.ok) return { ok: false, state, reason: target.reason };

  const board = cloneBoard(state.board);
  board[target.point.row][target.point.column] = player;

  const winningLine = findWinningLine(board, target.point, player, connectLengthFor(state));
  const moveCount = state.moveCount + 1;
  const winner = winningLine.length > 0
    ? player
    : moveCount === state.board.length * state.board[0].length
      ? "draw"
      : null;

  return okMove(state, board, player, target.point, { winningLine, winner });
}

function applyUltimateMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const meta = cloneMeta(state).ultimate!;
  const localSize = ultimateLocalSize(state);
  const target = resolveTarget(state, move);
  if (!target.ok) return { ok: false, state, reason: target.reason };

  const mini = ultimateBoardIndex(state, target.point.row, target.point.column);
  if (meta.activeBoard !== null && mini !== meta.activeBoard) {
    return { ok: false, state, reason: "Play inside the highlighted small board." };
  }
  if (meta.localWinners[mini]) {
    return { ok: false, state, reason: "That small board is already claimed." };
  }

  const board = cloneBoard(state.board);
  board[target.point.row][target.point.column] = player;

  const localLine = findLocalTicLine(state, board, mini, player);
  if (localLine.length > 0) meta.localWinners[mini] = player;
  else if (localCells(state, board, mini).every((cell) => cell !== null)) meta.localWinners[mini] = "draw";

  const globalWinnerLine = findMetaLine(meta.localWinners, player, localSize);
  const full = meta.localWinners.every(Boolean);
  const nextActive = ultimateLocalIndex(state, target.point.row, target.point.column);
  meta.activeBoard = meta.localWinners[nextActive] ? null : nextActive;

  const winner = globalWinnerLine.length > 0 ? player : full ? "draw" : null;
  return okMove(state, board, player, target.point, {
    winningLine: winner === player ? globalWinnerLine.flatMap((index) => miniCenterPoints(state, index)) : localLine,
    winner,
    meta: { ...cloneMeta(state), ultimate: meta }
  });
}

function applyDotsMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const meta = cloneMeta(state).dots!;
  if (move.edge !== "h" && move.edge !== "v") return { ok: false, state, reason: "Choose a line." };
  const row = move.row;
  const column = move.column;
  if (!Number.isInteger(row) || row === undefined || !Number.isInteger(column)) {
    return { ok: false, state, reason: "That line is outside the board." };
  }

  const edgeGrid = move.edge === "h" ? meta.hEdges : meta.vEdges;
  if (edgeGrid[row]?.[column] === undefined || edgeGrid[row][column]) {
    return { ok: false, state, reason: "That line is already drawn." };
  }

  const board = cloneBoard(state.board);
  edgeGrid[row][column] = true;
  const completed = completedBoxes(meta, move.edge, row, column)
    .filter((point) => !board[point.row][point.column]);
  for (const box of completed) board[box.row][box.column] = player;
  meta.scores[player] += completed.length;

  const edgeCount = meta.hEdges.flat().filter(Boolean).length + meta.vEdges.flat().filter(Boolean).length;
  const totalEdges = meta.size * (meta.size + 1) * 2;
  const winner = edgeCount === totalEdges
    ? meta.scores.p1 === meta.scores.p2
      ? "draw"
      : meta.scores.p1 > meta.scores.p2 ? "p1" : "p2"
    : null;

  return {
    ok: true,
    point: { row, column },
    state: {
      ...state,
      board,
      turn: completed.length > 0 ? player : otherPlayer(player),
      winner,
      winningLine: [],
      moveCount: state.moveCount + 1,
      meta: { ...cloneMeta(state), dots: meta }
    }
  };
}

function applyReversiMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const target = resolveTarget(state, move);
  if (!target.ok) return { ok: false, state, reason: target.reason };

  const flips = reversiFlips(state.board, target.point, player);
  if (flips.length === 0) return { ok: false, state, reason: "That disc would not capture anything." };

  const board = cloneBoard(state.board);
  board[target.point.row][target.point.column] = player;
  for (const point of flips) board[point.row][point.column] = player;

  const opponent = otherPlayer(player);
  const nextTurn = getReversiMoves({ ...state, board, turn: opponent }, opponent).length > 0 ? opponent : player;
  const noMoves = getReversiMoves({ ...state, board, turn: nextTurn }, nextTurn).length === 0;
  const winner = noMoves ? countWinner(board) : null;
  return okMove(state, board, nextTurn === player ? opponent : player, target.point, {
    winner,
    nextTurn
  });
}

function applyCheckersMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  if (!Number.isInteger(move.row) || move.row === undefined || !Number.isInteger(move.toRow) || !Number.isInteger(move.toColumn)) {
    return { ok: false, state, reason: "Choose a piece and destination." };
  }

  const from = { row: move.row, column: move.column };
  const to = { row: move.toRow!, column: move.toColumn! };
  if (cellAt(state.board, from) !== player) return { ok: false, state, reason: "Choose one of your pieces." };
  if (cellAt(state.board, to) !== null) return { ok: false, state, reason: "That landing spot is occupied." };
  if ((to.row + to.column) % 2 !== 1) return { ok: false, state, reason: "Checkers move on dark squares." };

  const legalMoves = getCheckersMoves(state, player);
  const legalMove = legalMoves.find((candidate) =>
    candidate.row === from.row &&
    candidate.column === from.column &&
    candidate.toRow === to.row &&
    candidate.toColumn === to.column
  );
  if (!legalMove) {
    const captureAvailable = collectCheckersMoves(state, player).captures.length > 0;
    if (state.meta?.checkers?.mustContinueFrom && keyOf(from) !== state.meta.checkers.mustContinueFrom) {
      return { ok: false, state, reason: "Continue the jump with the same checker." };
    }
    return {
      ok: false,
      state,
      reason: captureAvailable ? "You must take a jump when one is available." : "That checker cannot move there."
    };
  }

  const meta = cloneMeta(state).checkers!;
  const king = meta.kings.includes(keyOf(from));
  const rowDelta = to.row - from.row;
  const columnDelta = to.column - from.column;
  const direction = player === "p1" ? -1 : 1;
  const simple = Math.abs(rowDelta) === 1 && Math.abs(columnDelta) === 1 && (king || rowDelta === direction);
  const capture = Math.abs(rowDelta) === 2 && Math.abs(columnDelta) === 2 && (king || rowDelta === direction * 2);
  const board = cloneBoard(state.board);

  if (!simple && !capture) return { ok: false, state, reason: "That checker cannot move there." };
  if (capture) {
    const jumped = { row: from.row + rowDelta / 2, column: from.column + columnDelta / 2 };
    if (cellAt(board, jumped) !== otherPlayer(player)) return { ok: false, state, reason: "There is no piece to capture." };
    board[jumped.row][jumped.column] = null;
    meta.kings = meta.kings.filter((key) => key !== keyOf(jumped));
  }

  board[from.row][from.column] = null;
  board[to.row][to.column] = player;
  meta.kings = meta.kings.filter((key) => key !== keyOf(from));
  const crowned = to.row === (player === "p1" ? 0 : 7);
  if (king || crowned) meta.kings.push(keyOf(to));

  const continuationState: GameState = {
    ...state,
    board,
    meta: { ...cloneMeta(state), checkers: { ...meta, mustContinueFrom: keyOf(to) } },
    turn: player
  };
  const mustContinue = capture && !crowned && getCheckersMoves(continuationState, player).length > 0;
  meta.mustContinueFrom = mustContinue ? keyOf(to) : null;

  const opponent = otherPlayer(player);
  const winner = board.flat().includes(opponent) && getCheckersMoves({ ...state, board, meta: { ...cloneMeta(state), checkers: meta }, turn: opponent }, opponent).length > 0
    ? null
    : player;
  return okMove(state, board, player, to, {
    winner,
    nextTurn: mustContinue && !winner ? player : otherPlayer(player),
    meta: { ...cloneMeta(state), checkers: meta }
  });
}

function applyBattleshipMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const meta = cloneMeta(state).battleship!;
  const target = resolveTarget(state, move);
  if (!target.ok) return { ok: false, state, reason: target.reason };

  const shots = player === "p1" ? meta.humanShots : meta.botShots;
  const ships = player === "p1" ? meta.botShips : meta.playerShips;
  const key = keyOf(target.point);
  if (shots[key]) return { ok: false, state, reason: "That coordinate was already fired on." };

  const hit = ships.some((ship) => keyOf(ship) === key);
  shots[key] = hit ? "hit" : "miss";
  const board = cloneBoard(state.board);
  if (player === "p1" && hit) board[target.point.row][target.point.column] = "p1";

  const sunk = ships.every((ship) => shots[keyOf(ship)] === "hit");
  return okMove(state, board, player, target.point, {
    winner: sunk ? player : null,
    meta: { ...cloneMeta(state), battleship: meta }
  });
}

function applyMancalaMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const meta = cloneMeta(state).mancala!;
  const pitIndex = move.column;
  if (!Number.isInteger(pitIndex) || pitIndex < 0 || pitIndex > 5) {
    return { ok: false, state, reason: "Choose one of your pits." };
  }
  let stones = meta.pits[player][pitIndex];
  if (stones <= 0) return { ok: false, state, reason: "That pit is empty." };

  meta.pits[player][pitIndex] = 0;
  let side: PlayerMark = player;
  let index = pitIndex + 1;
  let last: { side: PlayerMark; index: number | "store" } = { side: player, index: pitIndex };
  while (stones > 0) {
    if (index < 6) {
      meta.pits[side][index] += 1;
      last = { side, index };
      stones -= 1;
      index += 1;
    } else {
      if (side === player) {
        meta.stores[player] += 1;
        last = { side, index: "store" };
        stones -= 1;
      }
      side = otherPlayer(side);
      index = 0;
    }
  }

  if (last.side === player && typeof last.index === "number" && meta.pits[player][last.index] === 1) {
    const opposite = 5 - last.index;
    const captured = meta.pits[otherPlayer(player)][opposite];
    if (captured > 0) {
      meta.pits[otherPlayer(player)][opposite] = 0;
      meta.pits[player][last.index] = 0;
      meta.stores[player] += captured + 1;
    }
  }

  let winner: Winner = null;
  if (meta.pits.p1.every((pit) => pit === 0) || meta.pits.p2.every((pit) => pit === 0)) {
    meta.stores.p1 += meta.pits.p1.reduce((sum, pit) => sum + pit, 0);
    meta.stores.p2 += meta.pits.p2.reduce((sum, pit) => sum + pit, 0);
    meta.pits.p1.fill(0);
    meta.pits.p2.fill(0);
    winner = meta.stores.p1 === meta.stores.p2 ? "draw" : meta.stores.p1 > meta.stores.p2 ? "p1" : "p2";
  }

  return {
    ok: true,
    point: { row: player === "p1" ? 1 : 0, column: pitIndex },
    state: {
      ...state,
      turn: last.index === "store" && last.side === player ? player : otherPlayer(player),
      winner,
      moveCount: state.moveCount + 1,
      meta: { ...cloneMeta(state), mancala: meta }
    }
  };
}

function applyHexMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const target = resolveTarget(state, move);
  if (!target.ok) return { ok: false, state, reason: target.reason };

  const board = cloneBoard(state.board);
  board[target.point.row][target.point.column] = player;
  const line = hexPath(board, player);
  return okMove(state, board, player, target.point, {
    winner: line.length > 0 ? player : null,
    winningLine: line
  });
}

function applyMorrisMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const meta = cloneMeta(state).morris!;
  const board = cloneBoard(state.board);

  if (meta.pendingRemoval) {
    if (meta.pendingRemoval !== player) {
      return { ok: false, state, reason: "Wait for the mill capture." };
    }
    const opponent = otherPlayer(player);
    const point = { row: move.row ?? -1, column: move.column };
    if (!isMorrisPoint(point) || cellAt(board, point) !== opponent) {
      return { ok: false, state, reason: "Choose an opponent piece to remove." };
    }
    const removable = removableMorrisPieces(board, opponent);
    if (!removable.some((candidate) => candidate.row === point.row && candidate.column === point.column)) {
      return { ok: false, state, reason: "Choose an exposed opponent piece." };
    }

    board[point.row][point.column] = null;
    meta.removed[opponent] += 1;
    meta.pendingRemoval = null;
    const winner = morrisWinnerAfterTurn(state, board, meta, player);
    return okMove(state, board, player, point, {
      winner,
      meta: { ...cloneMeta(state), morris: meta }
    });
  }

  const placing = meta.placed[player] < 9;
  let point: BoardPoint;

  if (placing) {
    point = { row: move.row ?? -1, column: move.column };
    if (!isMorrisPoint(point)) return { ok: false, state, reason: "Choose a Morris point." };
    if (cellAt(board, point)) return { ok: false, state, reason: "That point is occupied." };
    board[point.row][point.column] = player;
    meta.placed[player] += 1;
  } else {
    if (!Number.isInteger(move.row) || move.row === undefined || !Number.isInteger(move.toRow) || !Number.isInteger(move.toColumn)) {
      return { ok: false, state, reason: "Choose a piece and destination." };
    }
    const from = { row: move.row, column: move.column };
    point = { row: move.toRow!, column: move.toColumn! };
    if (cellAt(board, from) !== player) return { ok: false, state, reason: "Choose one of your pieces." };
    if (!isMorrisPoint(point) || cellAt(board, point)) return { ok: false, state, reason: "Choose an empty Morris point." };
    const canFly = countPieces(board, player) <= 3;
    if (!canFly && !MORRIS_NEIGHBORS[keyOf(from)]?.includes(keyOf(point))) {
      return { ok: false, state, reason: "Slide to a connected point." };
    }
    board[from.row][from.column] = null;
    board[point.row][point.column] = player;
  }

  if (formsMill(board, point, player) && removableMorrisPieces(board, otherPlayer(player)).length > 0) {
    meta.pendingRemoval = player;
  }

  const opponent = otherPlayer(player);
  const winner = meta.pendingRemoval ? null : morrisWinnerAfterTurn(state, board, meta, player);
  return okMove(state, board, player, point, {
    winner,
    nextTurn: meta.pendingRemoval ? player : undefined,
    meta: { ...cloneMeta(state), morris: meta }
  });
}

function morrisWinnerAfterTurn(state: GameState, board: Cell[][], meta: MorrisMeta, player: PlayerMark): Winner {
  const opponent = otherPlayer(player);
  if (meta.placed[opponent] < 9) return null;
  if (countPieces(board, opponent) < 3) return player;

  const opponentState: GameState = {
    ...state,
    board,
    turn: opponent,
    meta: { ...cloneMeta(state), morris: { ...meta, pendingRemoval: null } }
  };
  return getMorrisMoves(opponentState, opponent).length === 0 ? player : null;
}

function applyLastCardMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const clonedMeta = cloneMeta(state);
  const meta = clonedMeta.lastCard;
  const top = meta ? lastCardTop(meta) : undefined;
  if (!meta || !top) return { ok: false, state, reason: "The deck is not ready." };

  if (move.column === LAST_CARD_DRAW_MOVE) {
    if (getPlayableLastCardIndexes(meta, player).length > 0) {
      return { ok: false, state, reason: "Play a matching card before drawing." };
    }

    const drawn = drawLastCards(meta, player, 1);
    if (drawn === 0) return { ok: false, state, reason: "The draw pile is empty." };

    const drawnCard = meta.hands[player].at(-1);
    const playable = drawnCard ? isLastCardPlayable(drawnCard, top, meta.currentColor, meta.hands[player]) : false;
    meta.lastDraw = { player, count: drawn, playable };
    delete meta.lastAction;
    syncLastCardHandCounts(meta);
    return {
      ok: true,
      point: { row: 0, column: LAST_CARD_DRAW_MOVE },
      state: {
        ...state,
        turn: playable ? player : otherPlayer(player),
        winner: null,
        winningLine: [],
        moveCount: state.moveCount + 1,
        meta: { ...clonedMeta, lastCard: meta }
      }
    };
  }

  if (!Number.isInteger(move.column) || move.column < 0) {
    return { ok: false, state, reason: "Choose a card from your hand." };
  }

  const hand = meta.hands[player];
  const card = hand[move.column];
  if (!card) return { ok: false, state, reason: "That card is not in your hand." };
  if (!isLastCardPlayable(card, top, meta.currentColor, hand)) {
    return { ok: false, state, reason: "Match the discard color or rank." };
  }

  hand.splice(move.column, 1);
  meta.discard.push(card);
  meta.currentColor = card.color === "wild" ? chooseLastCardColor(meta.hands[player]) : card.color;
  meta.lastAction = card.rank;
  delete meta.lastDraw;

  const opponent = otherPlayer(player);
  let nextTurn = opponent;
  if (card.rank === "draw2") {
    const drawn = drawLastCards(meta, opponent, 2);
    meta.lastDraw = { player: opponent, count: drawn };
    nextTurn = player;
  } else if (card.rank === "wild4") {
    const drawn = drawLastCards(meta, opponent, 4);
    meta.lastDraw = { player: opponent, count: drawn };
    nextTurn = player;
  } else if (card.rank === "skip" || card.rank === "reverse") {
    nextTurn = player;
  }

  syncLastCardHandCounts(meta);
  return {
    ok: true,
    point: { row: 0, column: move.column },
    state: {
      ...state,
      turn: nextTurn,
      winner: hand.length === 0 ? player : null,
      winningLine: [],
      moveCount: state.moveCount + 1,
      meta: { ...clonedMeta, lastCard: meta }
    }
  };
}

function applyDartsMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const clonedMeta = cloneMeta(state);
  const meta = clonedMeta.darts;
  if (!meta) return { ok: false, state, reason: "The dartboard is not ready." };

  const target = dartsTargetFromMove(move);
  if (!target) return { ok: false, state, reason: "Choose a dart target." };

  const previousScore = meta.scores[player];
  const turnStartScore = previousScore + meta.turnScore;
  const nextScore = previousScore - target.value;
  meta.throws = [...meta.throws, { player, label: target.label, score: target.value }].slice(-9);
  meta.dartsLeft -= 1;
  meta.turnScore += target.value;

  let nextTurn = player;
  let winner: Winner = null;
  const checkout = nextScore === 0 && target.multiplier === 2;
  const bust = !checkout && nextScore < 2;
  if (checkout) {
    meta.scores[player] = 0;
    winner = player;
  } else if (bust) {
    meta.scores[player] = turnStartScore;
    meta.dartsLeft = 3;
    meta.turnScore = 0;
    nextTurn = otherPlayer(player);
  } else if (meta.dartsLeft <= 0) {
    meta.scores[player] = nextScore;
    meta.dartsLeft = 3;
    meta.turnScore = 0;
    nextTurn = otherPlayer(player);
  } else {
    meta.scores[player] = nextScore;
  }

  return {
    ok: true,
    point: { row: target.multiplier, column: move.column },
    state: {
      ...state,
      turn: winner ? player : nextTurn,
      winner,
      winningLine: [],
      moveCount: state.moveCount + 1,
      meta: { ...clonedMeta, darts: meta }
    }
  };
}

function applyWordHuntMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const clonedMeta = cloneMeta(state);
  const meta = normalizeWordHuntMeta(clonedMeta.wordHunt);
  if (!meta) return { ok: false, state, reason: "The word grid is not ready." };
  const activeMarks = wordHuntActiveMarks(state);
  const now = Date.now();
  if (wordHuntTimeRemaining(meta, now) <= 0) {
    return {
      ok: true,
      point: { row: 0, column: -1 },
      state: {
        ...state,
        winner: highestScoreWinner(meta.scores, activeMarks),
        winningLine: [],
        moveCount: state.moveCount + 1,
        meta: { ...clonedMeta, wordHunt: meta }
      }
    };
  }

  const word = cleanWord(move.word);
  if (!word) return { ok: false, state, reason: "Enter a word from the grid." };
  if (!meta.words.includes(word) || !wordCanBeMade(meta.letters, word)) {
    return { ok: false, state, reason: "That word is not hiding on this board." };
  }
  if (PLAYER_ORDER.some((mark) => meta.found[mark].includes(word))) {
    return { ok: false, state, reason: "That word was already found." };
  }

  meta.found[player].push(word);
  meta.scores[player] += wordScore(word);
  const foundCount = PLAYER_ORDER.reduce((count, mark) => count + meta.found[mark].length, 0);
  const winner = foundCount >= meta.words.length ? highestScoreWinner(meta.scores, activeMarks) : null;

  return {
    ok: true,
    point: { row: 0, column: Math.max(0, meta.words.indexOf(word)) },
    state: {
      ...state,
      turn: otherPlayer(player),
      winner,
      winningLine: [],
      moveCount: state.moveCount + 1,
      meta: { ...clonedMeta, wordHunt: meta }
    }
  };
}

function applyCupPongMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const clonedMeta = cloneMeta(state);
  const meta = clonedMeta.cupPong;
  if (!meta) return { ok: false, state, reason: "The cups are not ready." };

  const result = applyCupPongIntent(meta, player as CupPongPlayerMark, move);
  if (!result.ok) return { ok: false, state, reason: result.reason };

  return {
    ok: true,
    point: result.point,
    state: {
      ...state,
      turn: result.nextTurn,
      winner: result.winner,
      winningLine: [],
      moveCount: state.moveCount + 1,
      meta: { ...clonedMeta, cupPong: result.meta }
    }
  };
}

function applyDominoMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const clonedMeta = cloneMeta(state);
  const meta = clonedMeta.dominoes;
  if (!meta) return { ok: false, state, reason: "The domino rack is not ready." };
  const result = applyDominoIntent(meta, player as DominoPlayerMark, move);
  if (!result.ok) return { ok: false, state, reason: result.reason };

  return {
    ok: true,
    point: result.point,
    state: {
      ...state,
      turn: result.nextTurn,
      winner: result.winner,
      winningLine: [],
      moveCount: state.moveCount + 1,
      meta: { ...clonedMeta, dominoes: result.meta }
    }
  };
}

function okMove(
  state: GameState,
  board: Cell[][],
  player: PlayerMark,
  point: BoardPoint,
  options: {
    winner?: Winner;
    winningLine?: BoardPoint[];
    meta?: GameMeta;
    nextTurn?: PlayerMark;
  } = {}
): MoveResult {
  return {
    ok: true,
    point,
    state: {
      ...state,
      board,
      turn: options.nextTurn ?? otherPlayer(player),
      winner: options.winner ?? null,
      winningLine: options.winningLine ?? [],
      moveCount: state.moveCount + 1,
      meta: options.meta ?? state.meta
    }
  };
}

function getConnectMoves(state: GameState): GameMove[] {
  const definition = getGameDefinition(state.gameId);
  if (definition.moveMode === "drop-column") {
    return Array.from({ length: state.board[0].length }, (_, column) => ({ column }))
      .filter((move) => !state.board[0][move.column]);
  }

  if (state.gameId === "gomoku" && state.moveCount === 0) {
    return [{ row: Math.floor(state.board.length / 2), column: Math.floor(state.board[0].length / 2) }];
  }

  const moves = getEmptyCellMoves(state);
  if (state.gameId !== "gomoku") return moves;
  const nearby = moves.filter((move) => hasNeighbor(state.board, move.row!, move.column, 2));
  return nearby.length > 0 ? nearby : moves;
}

function getEmptyCellMoves(state: GameState): GameMove[] {
  const moves: GameMove[] = [];
  for (const [rowIndex, row] of state.board.entries()) {
    for (const [columnIndex, cell] of row.entries()) {
      if (!cell) moves.push({ row: rowIndex, column: columnIndex });
    }
  }
  return moves;
}

function getUltimateMoves(state: GameState): GameMove[] {
  const meta = state.meta?.ultimate;
  if (!meta) return [];
  return getEmptyCellMoves(state).filter((move) => {
    const mini = ultimateBoardIndex(state, move.row!, move.column);
    return !meta.localWinners[mini] && (meta.activeBoard === null || meta.activeBoard === mini);
  });
}

function getDotsMoves(state: GameState): GameMove[] {
  const meta = state.meta?.dots;
  if (!meta) return [];
  const moves: GameMove[] = [];
  for (let row = 0; row < meta.hEdges.length; row += 1) {
    for (let column = 0; column < meta.hEdges[row].length; column += 1) {
      if (!meta.hEdges[row][column]) moves.push({ edge: "h", row, column });
    }
  }
  for (let row = 0; row < meta.vEdges.length; row += 1) {
    for (let column = 0; column < meta.vEdges[row].length; column += 1) {
      if (!meta.vEdges[row][column]) moves.push({ edge: "v", row, column });
    }
  }
  return moves;
}

function chooseDotsMove(
  state: GameState,
  legalMoves: GameMove[],
  difficulty: BotDifficulty
): GameMove {
  const meta = state.meta?.dots;
  if (!meta) return orderedMoves(state, legalMoves)[0];
  const ordered = orderedMoves(state, legalMoves);
  const scoring = ordered
    .map((move) => ({ move, completed: boxesCompletedByDotsMove(meta, move).length }))
    .filter((candidate) => candidate.completed > 0)
    .sort((a, b) => b.completed - a.completed);
  if (scoring[0]) return scoring[0].move;

  const safeMoves = ordered.filter((move) => !wouldLeaveThreeSidedBox(meta, move));
  if (safeMoves.length > 0) {
    if (difficulty === "casual") return safeMoves[0];
    return chooseBySearch(state, state.turn, safeMoves, difficulty === "sharp" ? 2 : 3);
  }

  return ordered
    .map((move) => ({ move, danger: dotsDangerScore(meta, move) }))
    .sort((a, b) => a.danger - b.danger)[0].move;
}

function boxesCompletedByDotsMove(meta: DotsMeta, move: GameMove): BoardPoint[] {
  if (move.edge !== "h" && move.edge !== "v") return [];
  if (!Number.isInteger(move.row) || move.row === undefined || !Number.isInteger(move.column)) return [];
  const next = cloneDotsMeta(meta);
  if (next[move.edge === "h" ? "hEdges" : "vEdges"][move.row]?.[move.column] === undefined) return [];
  next[move.edge === "h" ? "hEdges" : "vEdges"][move.row][move.column] = true;
  return completedBoxes(next, move.edge, move.row, move.column);
}

function wouldLeaveThreeSidedBox(meta: DotsMeta, move: GameMove): boolean {
  if (boxesCompletedByDotsMove(meta, move).length > 0) return false;
  if (move.edge !== "h" && move.edge !== "v") return false;
  if (!Number.isInteger(move.row) || move.row === undefined || !Number.isInteger(move.column)) return false;
  const next = cloneDotsMeta(meta);
  next[move.edge === "h" ? "hEdges" : "vEdges"][move.row][move.column] = true;
  return adjacentDotsBoxes(meta, move.edge, move.row, move.column).some((box) =>
    dotsBoxSideCount(next, box.row, box.column) === 3
  );
}

function dotsDangerScore(meta: DotsMeta, move: GameMove): number {
  if (move.edge !== "h" && move.edge !== "v") return Number.POSITIVE_INFINITY;
  if (!Number.isInteger(move.row) || move.row === undefined || !Number.isInteger(move.column)) return Number.POSITIVE_INFINITY;
  const next = cloneDotsMeta(meta);
  next[move.edge === "h" ? "hEdges" : "vEdges"][move.row][move.column] = true;
  return adjacentDotsBoxes(meta, move.edge, move.row, move.column)
    .reduce((score, box) => score + dotsBoxSideCount(next, box.row, box.column), 0);
}

function chooseCheckersMove(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[],
  difficulty: BotDifficulty
): GameMove {
  const scored = orderedMoves(state, legalMoves)
    .map((move) => {
      const result = applyGameMove({ ...state, turn: player }, player, move);
      const to = { row: move.toRow ?? 0, column: move.toColumn ?? move.column };
      const from = { row: move.row ?? 0, column: move.column };
      const capture = Math.abs(to.row - from.row) === 2;
      const crowns = to.row === (player === "p1" ? 0 : 7);
      const pieceIsKing = state.meta?.checkers?.kings?.includes(keyOf(from)) ?? false;
      const center = 12 - (Math.abs(to.row - 3.5) + Math.abs(to.column - 3.5)) * 2;
      const continuation = result.ok && result.state.turn === player && !result.state.winner ? 260 : 0;
      const tacticScore = (capture ? 720 : 0) + (crowns ? 560 : 0) + (pieceIsKing ? 90 : 0) + center + continuation;
      const searchScore = result.ok
        ? difficulty === "casual"
          ? boardScore(result.state, player)
          : evaluateState(result.state, player, difficulty === "sharp" ? 2 : 4)
        : Number.NEGATIVE_INFINITY;
      const noise = difficulty === "casual" ? Math.random() * 140 : difficulty === "sharp" ? Math.random() * 18 : 0;
      return { move, score: tacticScore + searchScore + noise };
    })
    .sort((a, b) => b.score - a.score);

  if (difficulty === "casual" && scored.length > 1) {
    return scored[Math.floor(Math.random() * Math.min(2, scored.length))]?.move ?? scored[0].move;
  }

  return scored[0]?.move ?? legalMoves[0];
}

function chooseBattleshipMove(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[],
  difficulty: BotDifficulty
): GameMove {
  const meta = state.meta?.battleship;
  if (!meta) return legalMoves[0];
  const shots = player === "p1" ? meta.humanShots : meta.botShots;
  const unshot = new Set(legalMoves.map((move) => keyOf({ row: move.row ?? 0, column: move.column })));
  const hitPoints = activeBattleshipHits(meta, player, shots);
  const lineTargets = battleshipLineTargets(hitPoints, unshot);

  if (lineTargets.length > 0) {
    return orderedBattleshipTargets(lineTargets, shots)[0] ?? legalMoves[0];
  }

  const targetMoves = battleshipAdjacentTargets(hitPoints, unshot);

  if (targetMoves.length > 0) {
    return orderedBattleshipTargets(targetMoves, shots)[0] ?? legalMoves[0];
  }

  const huntMoves = difficulty === "casual"
    ? legalMoves
    : legalMoves.filter((move) => ((move.row ?? 0) + move.column) % 2 === 0);
  const candidates = huntMoves.length > 0 ? huntMoves : legalMoves;
  const ordered = orderedBattleshipTargets(candidates, shots);
  if (difficulty === "casual") return ordered[Math.floor(Math.random() * ordered.length)] ?? legalMoves[0];
  if (difficulty === "sharp" && ordered.length > 3) {
    return ordered[Math.floor(Math.random() * Math.min(3, ordered.length))] ?? ordered[0];
  }
  return ordered[0] ?? legalMoves[0];
}

function activeBattleshipHits(
  meta: BattleshipMeta,
  player: PlayerMark,
  shots: Record<string, "hit" | "miss">
): BoardPoint[] {
  const targetFleet = player === "p1" ? meta.botFleet : meta.playerFleet;
  const sunkKeys = new Set(
    targetFleet
      .filter((ship) => ship.cells.every((cell) => shots[keyOf(cell)] === "hit"))
      .flatMap((ship) => ship.cells.map((cell) => keyOf(cell)))
  );
  return Object.entries(shots)
    .filter(([key, shot]) => shot === "hit" && !sunkKeys.has(key))
    .map(([key]) => pointFromKey(key));
}

function battleshipLineTargets(hitPoints: BoardPoint[], unshot: Set<string>): GameMove[] {
  const moves = new Map<string, GameMove>();
  for (const cluster of battleshipHitClusters(hitPoints).filter((candidate) => candidate.length >= 2)) {
    const rows = new Set(cluster.map((point) => point.row));
    const columns = new Set(cluster.map((point) => point.column));
    if (rows.size === 1) {
      const row = cluster[0].row;
      const orderedColumns = cluster.map((point) => point.column).sort((a, b) => a - b);
      for (const column of [orderedColumns[0] - 1, orderedColumns.at(-1)! + 1]) {
        const point = { row, column };
        if (unshot.has(keyOf(point))) moves.set(keyOf(point), point);
      }
    } else if (columns.size === 1) {
      const column = cluster[0].column;
      const orderedRows = cluster.map((point) => point.row).sort((a, b) => a - b);
      for (const row of [orderedRows[0] - 1, orderedRows.at(-1)! + 1]) {
        const point = { row, column };
        if (unshot.has(keyOf(point))) moves.set(keyOf(point), point);
      }
    }
  }
  return [...moves.values()];
}

function battleshipHitClusters(hitPoints: BoardPoint[]): BoardPoint[][] {
  const pointByKey = new Map(hitPoints.map((point) => [keyOf(point), point]));
  const seen = new Set<string>();
  const clusters: BoardPoint[][] = [];
  for (const point of hitPoints) {
    const startKey = keyOf(point);
    if (seen.has(startKey)) continue;
    const cluster: BoardPoint[] = [];
    const queue = [point];
    seen.add(startKey);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      cluster.push(current);
      for (const neighbor of orthogonalNeighbors(current)) {
        const neighborKey = keyOf(neighbor);
        const next = pointByKey.get(neighborKey);
        if (!next || seen.has(neighborKey)) continue;
        seen.add(neighborKey);
        queue.push(next);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function battleshipAdjacentTargets(hitPoints: BoardPoint[], unshot: Set<string>): GameMove[] {
  const moves = new Map<string, GameMove>();
  for (const point of hitPoints) {
    for (const candidate of orthogonalNeighbors(point)) {
      if (candidate.row < 0 || candidate.row >= 10 || candidate.column < 0 || candidate.column >= 10) continue;
      if (unshot.has(keyOf(candidate))) moves.set(keyOf(candidate), candidate);
    }
  }
  return [...moves.values()];
}

function orthogonalNeighbors(point: BoardPoint): BoardPoint[] {
  return [
    { row: point.row - 1, column: point.column },
    { row: point.row + 1, column: point.column },
    { row: point.row, column: point.column - 1 },
    { row: point.row, column: point.column + 1 }
  ];
}

function orderedBattleshipTargets(moves: GameMove[], shots: Record<string, "hit" | "miss">): GameMove[] {
  const center = 4.5;
  return [...moves].sort((a, b) => {
    const aRow = a.row ?? 0;
    const bRow = b.row ?? 0;
    const aNeighborHits = battleshipNeighborHits({ row: aRow, column: a.column }, shots);
    const bNeighborHits = battleshipNeighborHits({ row: bRow, column: b.column }, shots);
    if (aNeighborHits !== bNeighborHits) return bNeighborHits - aNeighborHits;
    const aDistance = Math.abs(aRow - center) + Math.abs(a.column - center);
    const bDistance = Math.abs(bRow - center) + Math.abs(b.column - center);
    return aDistance - bDistance;
  });
}

function battleshipNeighborHits(point: BoardPoint, shots: Record<string, "hit" | "miss">): number {
  return orthogonalNeighbors(point).filter((candidate) => shots[keyOf(candidate)] === "hit").length;
}

function adjacentDotsBoxes(meta: DotsMeta, edge: "h" | "v", row: number, column: number): BoardPoint[] {
  const boxes = edge === "h"
    ? [{ row: row - 1, column }, { row, column }]
    : [{ row, column: column - 1 }, { row, column }];
  return boxes.filter((box) =>
    box.row >= 0 &&
    box.row < meta.size &&
    box.column >= 0 &&
    box.column < meta.size
  );
}

function dotsBoxSideCount(meta: DotsMeta, row: number, column: number): number {
  return Number(meta.hEdges[row][column]) +
    Number(meta.hEdges[row + 1][column]) +
    Number(meta.vEdges[row][column]) +
    Number(meta.vEdges[row][column + 1]);
}

function getReversiMoves(state: GameState, player: PlayerMark): GameMove[] {
  return getEmptyCellMoves(state).filter((move) =>
    reversiFlips(state.board, { row: move.row!, column: move.column }, player).length > 0
  );
}

function getCheckersMoves(state: GameState, player: PlayerMark): GameMove[] {
  const { simpleMoves, captures } = collectCheckersMoves(state, player);
  return captures.length > 0 ? captures : simpleMoves;
}

function collectCheckersMoves(state: GameState, player: PlayerMark): { simpleMoves: GameMove[]; captures: GameMove[] } {
  const simpleMoves: GameMove[] = [];
  const captures: GameMove[] = [];
  const kings = state.meta?.checkers?.kings ?? [];
  const rawForcedSource = state.meta?.checkers?.mustContinueFrom ?? null;
  const forcedPoint = rawForcedSource ? pointFromKey(rawForcedSource) : null;
  const forcedSource = forcedPoint && cellAt(state.board, forcedPoint) === player ? rawForcedSource : null;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      if (state.board[row][column] !== player) continue;
      if (forcedSource && forcedSource !== `${row},${column}`) continue;
      const dirs = kings.includes(`${row},${column}`)
        ? [-1, 1]
        : [player === "p1" ? -1 : 1];
      for (const rowDir of dirs) {
        for (const columnDir of [-1, 1]) {
          const simple = { row: row + rowDir, column: column + columnDir };
          if (!forcedSource && cellAt(state.board, simple) === null) {
            simpleMoves.push({ row, column, toRow: simple.row, toColumn: simple.column });
          }
          const jumped = { row: row + rowDir, column: column + columnDir };
          const landing = { row: row + rowDir * 2, column: column + columnDir * 2 };
          if (cellAt(state.board, jumped) === otherPlayer(player) && cellAt(state.board, landing) === null) {
            captures.push({ row, column, toRow: landing.row, toColumn: landing.column });
          }
        }
      }
    }
  }
  return { simpleMoves, captures };
}

function getBattleshipMoves(state: GameState, player: PlayerMark): GameMove[] {
  const meta = state.meta?.battleship;
  if (!meta) return [];
  const shots = player === "p1" ? meta.humanShots : meta.botShots;
  const moves: GameMove[] = [];
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      if (!shots[`${row},${column}`]) moves.push({ row, column });
    }
  }
  return moves;
}

function getMancalaMoves(state: GameState, player: PlayerMark): GameMove[] {
  const pits = state.meta?.mancala?.pits[player] ?? [];
  return pits.map((stones, column) => ({ stones, column }))
    .filter((pit) => pit.stones > 0)
    .map(({ column }) => ({ column }));
}

function getMorrisMoves(state: GameState, player: PlayerMark): GameMove[] {
  const meta = state.meta?.morris;
  if (!meta) return [];
  if (meta.pendingRemoval) {
    if (meta.pendingRemoval !== player) return [];
    return removableMorrisPieces(state.board, otherPlayer(player)).map((point) => ({ row: point.row, column: point.column }));
  }
  if (meta.placed[player] < 9) {
    return [...MORRIS_POINTS].map(pointFromKey).filter((point) => !cellAt(state.board, point));
  }

  const canFly = countPieces(state.board, player) <= 3;
  const moves: GameMove[] = [];
  for (const key of MORRIS_POINTS) {
    const from = pointFromKey(key);
    if (cellAt(state.board, from) !== player) continue;
    const destinations = canFly
      ? [...MORRIS_POINTS]
      : MORRIS_NEIGHBORS[key] ?? [];
    for (const destinationKey of destinations) {
      const to = pointFromKey(destinationKey);
      if (!cellAt(state.board, to)) moves.push({ row: from.row, column: from.column, toRow: to.row, toColumn: to.column });
    }
  }
  return moves;
}

function getLastCardMoves(state: GameState, player: PlayerMark): GameMove[] {
  const meta = state.meta?.lastCard;
  const top = meta ? lastCardTop(meta) : undefined;
  if (!meta || !top) return [];

  const playable = getPlayableLastCardIndexes(meta, player).map((column) => ({ column }));
  if (playable.length > 0) return playable;
  return canDrawLastCard(meta) ? [{ column: LAST_CARD_DRAW_MOVE }] : [];
}

function getDartsMoves(_state: GameState): GameMove[] {
  const segmentMoves = DARTS_SEGMENTS.flatMap((_, index) => [
    { row: 1, column: index },
    { row: 2, column: index },
    { row: 3, column: index }
  ]);
  return [
    ...segmentMoves,
    { row: 25, column: DARTS_BULL_INDEX },
    { row: 50, column: DARTS_BULL_INDEX + 1 },
    { row: 0, column: DARTS_MISS_COLUMN }
  ];
}

function getWordHuntMoves(state: GameState, player: PlayerMark): GameMove[] {
  const meta = normalizeWordHuntMeta(state.meta?.wordHunt);
  if (!meta) return [];
  if (wordHuntTimeRemaining(meta) <= 0) return [];
  const found = new Set(PLAYER_ORDER.flatMap((mark) => meta.found[mark]));
  const candidates = meta.words.filter((word) => !found.has(word));
  const limit = player.startsWith("p") ? candidates.length : 0;
  return candidates.slice(0, limit).map((word, index) => ({ column: index, word }));
}

function getCupPongMoves(state: GameState, player: PlayerMark): GameMove[] {
  const meta = state.meta?.cupPong;
  if (!meta) return [];
  return getCupPongLegalMoves(normalizeCupPongMeta(meta), player as CupPongPlayerMark);
}

function getDominoMoves(state: GameState, player: PlayerMark): GameMove[] {
  const meta = state.meta?.dominoes;
  if (!meta) return [];
  const normalized = normalizeDominoMeta(meta);
  const moves = getDominoLegalMoves(normalized, player as DominoPlayerMark);
  return moves.length > 0
    ? moves.map((move) => ({ column: move.column, edge: move.edge }))
    : [{ column: -1 }];
}

function chooseLastCardMove(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[],
  difficulty: BotDifficulty
): GameMove {
  const meta = state.meta?.lastCard;
  if (!meta) return legalMoves[0];

  const plays = legalMoves.filter((move) => move.column !== LAST_CARD_DRAW_MOVE);
  if (plays.length === 0) return legalMoves.find((move) => move.column === LAST_CARD_DRAW_MOVE) ?? legalMoves[0];

  const winning = plays.find((move) => meta.hands[player].length === 1 && meta.hands[player][move.column]);
  if (winning) return winning;

  const scored = plays
    .map((move) => ({ move, score: lastCardMoveScore(meta, player, move, difficulty) }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.move ?? plays[0];
}

function chooseDartsMove(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[],
  difficulty: BotDifficulty
): GameMove {
  const score = state.meta?.darts?.scores[player] ?? 301;
  const scored = legalMoves
    .map((move) => {
      const target = dartsTargetFromMove(move);
      if (!target) return { move, rank: Number.NEGATIVE_INFINITY };
      const remaining = score - target.value;
      const checkout = remaining === 0 && target.multiplier === 2;
      const exact = checkout ? 100_000 : 0;
      const bustPenalty = !checkout && remaining < 2 ? -50_000 : 0;
      const pressure = remaining >= 2 ? Math.max(0, 80 - Math.abs(remaining)) * 4 : 0;
      const power = difficulty === "casual" ? target.value * Math.random() : target.value;
      return { move, rank: exact + bustPenalty + pressure + power };
    })
    .sort((a, b) => b.rank - a.rank);
  return scored[0]?.move ?? legalMoves[0];
}

function chooseWordHuntMove(
  _state: GameState,
  _player: PlayerMark,
  legalMoves: GameMove[],
  difficulty: BotDifficulty
): GameMove {
  const sorted = [...legalMoves].sort((a, b) => {
    const wordA = a.word ?? "";
    const wordB = b.word ?? "";
    return difficulty === "casual" ? wordA.length - wordB.length : wordB.length - wordA.length;
  });
  if (difficulty === "casual" && sorted.length > 1) return sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
  return sorted[0] ?? legalMoves[0];
}

function chooseCupPongMove(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[],
  difficulty: BotDifficulty
): GameMove {
  const meta = state.meta?.cupPong;
  if (!meta) return legalMoves[0];
  return chooseCupPongBotMove(normalizeCupPongMeta(meta), player as CupPongPlayerMark, legalMoves, difficulty);
}

function chooseDominoMove(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[],
  difficulty: BotDifficulty
): GameMove {
  const meta = state.meta?.dominoes;
  if (!meta) return legalMoves[0];
  return chooseDominoBotMove(normalizeDominoMeta(meta), player as DominoPlayerMark, legalMoves, difficulty);
}

function resolveTarget(state: GameState, move: GameMove): { ok: true; point: BoardPoint } | { ok: false; reason: string } {
  const definition = getGameDefinition(state.gameId);
  if (!Number.isInteger(move.column) || move.column < 0 || move.column >= state.board[0].length) {
    return { ok: false, reason: "That move is outside the board." };
  }

  if (definition.moveMode === "drop-column") {
    for (let row = state.board.length - 1; row >= 0; row -= 1) {
      if (!state.board[row][move.column]) return { ok: true, point: { row, column: move.column } };
    }
    return { ok: false, reason: "That column is full." };
  }

  if (!Number.isInteger(move.row) || move.row === undefined || move.row < 0 || move.row >= state.board.length) {
    return { ok: false, reason: "That move is outside the board." };
  }
  if (state.board[move.row][move.column]) return { ok: false, reason: "That spot is already taken." };
  return { ok: true, point: { row: move.row, column: move.column } };
}

function findWinningLine(board: Cell[][], point: BoardPoint, player: PlayerMark, connectLength: number): BoardPoint[] {
  for (const direction of DIRECTIONS) {
    const line = [
      ...walk(board, point, player, { row: -direction.row, column: -direction.column }).reverse(),
      point,
      ...walk(board, point, player, direction)
    ];
    if (line.length >= connectLength) return line.slice(0, connectLength);
  }
  return [];
}

function walk(board: Cell[][], point: BoardPoint, player: PlayerMark, delta: BoardPoint): BoardPoint[] {
  const points: BoardPoint[] = [];
  let row = point.row + delta.row;
  let column = point.column + delta.column;
  while (row >= 0 && row < board.length && column >= 0 && column < board[0].length && board[row][column] === player) {
    points.push({ row, column });
    row += delta.row;
    column += delta.column;
  }
  return points;
}

function findImmediateWinningMove(state: GameState, player: PlayerMark, legalMoves: GameMove[]): GameMove | null {
  for (const move of orderedMoves(state, legalMoves)) {
    const result = applyGameMove({ ...state, turn: player }, player, move);
    if (result.ok && result.state.winner === player) return move;
  }
  return null;
}

function chooseFourInARowMove(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[],
  difficulty: BotDifficulty
): GameMove {
  if (state.moveCount === 0 && difficulty !== "ruthless") {
    return legalMoves.find((move) => move.column === Math.floor(state.board[0].length / 2)) ?? orderedFourMoves(state, legalMoves)[0];
  }
  if (state.moveCount === 0) {
    return legalMoves.find((move) => move.column === 2) ?? legalMoves.find((move) => move.column === 4) ?? orderedFourMoves(state, legalMoves)[0];
  }
  if (difficulty === "ruthless" && state.moveCount <= 2) {
    return chooseFourInARowOpeningMove(state, legalMoves);
  }
  if (difficulty === "casual") return chooseBySearch(state, player, legalMoves, 2);
  if (difficulty === "sharp") return chooseFourInARowBySearch(state, player, legalMoves, 4);

  return chooseFourInARowBySearch(state, player, legalMoves, 4);
}

function chooseFourInARowOpeningMove(state: GameState, legalMoves: GameMove[]): GameMove {
  const center = Math.floor(state.board[0].length / 2);
  const opponentColumns = new Set<number>();
  for (const row of state.board) {
    row.forEach((cell, column) => {
      if (cell && cell !== state.turn) opponentColumns.add(column);
    });
  }

  const flankPreference = opponentColumns.has(center)
    ? [center - 1, center + 1, center - 2, center + 2, center]
    : [center - 1, center + 1, center, center - 2, center + 2];
  const orderedColumns = [...flankPreference, 1, 5, 0, 6];

  for (const column of orderedColumns) {
    const move = legalMoves.find((candidate) => candidate.column === column);
    if (move) return move;
  }
  return orderedFourMoves(state, legalMoves)[0];
}

function chooseFourInARowBySearch(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[],
  depth: number
): GameMove {
  const table = new Map<string, { depth: number; score: number }>();
  return orderedFourMoves(state, legalMoves)
    .map((move) => {
      const result = applyGameMove(state, player, move);
      return {
        move,
        score: result.ok
          ? fourInARowMinimax(result.state, player, depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, table) +
            fourColumnBias(state, move)
          : Number.NEGATIVE_INFINITY
      };
    })
    .sort((a, b) => b.score - a.score)[0].move;
}

function fourInARowMinimax(
  state: GameState,
  bot: PlayerMark,
  depth: number,
  alpha: number,
  beta: number,
  table: Map<string, { depth: number; score: number }>
): number {
  if (state.winner || depth === 0) return fourInARowScore(state, bot);

  const key = fourInARowCacheKey(state);
  const cached = table.get(key);
  if (cached && cached.depth >= depth) return cached.score;

  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0) return fourInARowScore(state, bot);

  const maximizing = state.turn === bot;
  let exact = true;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (const move of orderedFourMoves(state, legalMoves)) {
    const result = applyGameMove(state, state.turn, move);
    if (!result.ok) continue;
    const score = fourInARowMinimax(result.state, bot, depth - 1, alpha, beta, table);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) {
      exact = false;
      break;
    }
  }

  if (exact) table.set(key, { depth, score: best });
  return best;
}

function fourInARowScore(state: GameState, bot: PlayerMark): number {
  const opponent = otherPlayer(bot);
  if (state.winner === bot) return 12_000_000 + (1000 - state.moveCount);
  if (state.winner === opponent) return -12_000_000 - (1000 - state.moveCount);
  if (state.winner === "draw") return 0;

  const botThreats = countFourWinningDrops(state, bot);
  const opponentThreats = countFourWinningDrops(state, opponent);
  const threatScore =
    (botThreats > 1 ? 420_000 : botThreats * 120_000) -
    (opponentThreats > 1 ? 520_000 : opponentThreats * 145_000);

  return (
    threatScore +
    fourWindowScore(state, bot) -
    fourWindowScore(state, opponent) * 1.18 +
    centerColumnScore(state, bot) -
    centerColumnScore(state, opponent) * 1.04 +
    pieceScore(state, bot) -
    pieceScore(state, opponent)
  );
}

function fourWindowScore(state: GameState, player: PlayerMark): number {
  const opponent = otherPlayer(player);
  let score = 0;
  for (let row = 0; row < state.board.length; row += 1) {
    for (let column = 0; column < state.board[0].length; column += 1) {
      for (const direction of DIRECTIONS) {
        const points = Array.from({ length: 4 }, (_, index) => ({
          row: row + direction.row * index,
          column: column + direction.column * index
        }));
        if (points.some((point) => cellAt(state.board, point) === undefined)) continue;
        score += fourWindowPoints(state.board, points, player, opponent);
      }
    }
  }
  return score;
}

function fourWindowPoints(board: Cell[][], points: BoardPoint[], player: PlayerMark, opponent: PlayerMark): number {
  const cells = points.map((point) => cellAt(board, point));
  const own = cells.filter((cell) => cell === player).length;
  const against = cells.filter((cell) => cell === opponent).length;
  const emptyPoints = points.filter((point) => cellAt(board, point) === null);
  if (own > 0 && against > 0) return 0;
  if (own === 4) return 900_000;
  if (own === 3 && emptyPoints.length === 1) return isFourPlayablePoint(board, emptyPoints[0]) ? 96_000 : 38_000;
  if (own === 2 && emptyPoints.length === 2) {
    return emptyPoints.some((point) => isFourPlayablePoint(board, point)) ? 4_200 : 1_600;
  }
  if (own === 1 && emptyPoints.length === 3) return 180;
  return 0;
}

function countFourWinningDrops(state: GameState, player: PlayerMark): number {
  let count = 0;
  for (let column = 0; column < state.board[0].length; column += 1) {
    const row = fourDropRow(state.board, column);
    if (row === null) continue;
    state.board[row][column] = player;
    if (findWinningLine(state.board, { row, column }, player, 4).length > 0) count += 1;
    state.board[row][column] = null;
  }
  return count;
}

function fourDropRow(board: Cell[][], column: number): number | null {
  for (let row = board.length - 1; row >= 0; row -= 1) {
    if (!board[row][column]) return row;
  }
  return null;
}

function isFourPlayablePoint(board: Cell[][], point: BoardPoint): boolean {
  return cellAt(board, point) === null && (point.row === board.length - 1 || cellAt(board, { row: point.row + 1, column: point.column }) !== null);
}

function centerColumnScore(state: GameState, player: PlayerMark): number {
  const center = Math.floor(state.board[0].length / 2);
  let score = 0;
  for (let row = 0; row < state.board.length; row += 1) {
    for (let column = 0; column < state.board[0].length; column += 1) {
      if (state.board[row][column] !== player) continue;
      score += Math.max(0, 120 - Math.abs(column - center) * 32 - Math.abs(row - (state.board.length - 1)) * 3);
    }
  }
  return score;
}

function orderedFourMoves(state: GameState, moves: GameMove[]): GameMove[] {
  return [...moves].sort((a, b) => fourColumnBias(state, b) - fourColumnBias(state, a));
}

function fourColumnBias(state: GameState, move: GameMove): number {
  const center = (state.board[0].length - 1) / 2;
  const landingRow = fourDropRow(state.board, move.column);
  const supportBonus = landingRow === null ? -80 : state.board.length - landingRow;
  const flankBonus = move.column === 2 || move.column === 4 ? 18 : 0;
  const centerPenalty = move.column === Math.floor(center) ? -22 : 0;
  return 100 - Math.abs(move.column - center) * 8 + supportBonus + flankBonus + centerPenalty;
}

function fourInARowCacheKey(state: GameState): string {
  return `${state.turn}:${state.board.map((row) => row.map((cell) => cell === null ? "." : cell === "p1" ? "1" : "2").join("")).join("")}`;
}

function chooseBySearch(state: GameState, player: PlayerMark, legalMoves: GameMove[], depth: number): GameMove {
  return orderedMoves(state, legalMoves)
    .map((move) => {
      const result = applyGameMove({ ...state, turn: player }, player, move);
      return { move, score: result.ok ? evaluateState(result.state, player, depth - 1) : Number.NEGATIVE_INFINITY };
    })
    .sort((a, b) => b.score - a.score)[0].move;
}

function chooseByMinimax(state: GameState, player: PlayerMark, legalMoves: GameMove[], depth: number): GameMove {
  return orderedMoves(state, legalMoves)
    .map((move) => {
      const result = applyGameMove(state, player, move);
      return {
        move,
        score: result.ok
          ? minimax(result.state, player, depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
          : Number.NEGATIVE_INFINITY
      };
    })
    .sort((a, b) => b.score - a.score)[0].move;
}

function minimax(state: GameState, bot: PlayerMark, depth: number, alpha: number, beta: number): number {
  if (state.winner || depth === 0) return boardScore(state, bot);
  const maximizing = state.turn === bot;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  for (const move of orderedMoves(state, getLegalMoves(state))) {
    const result = applyGameMove(state, state.turn, move);
    if (!result.ok) continue;
    const score = minimax(result.state, bot, depth - 1, alpha, beta);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function evaluateState(state: GameState, bot: PlayerMark, depth: number): number {
  if (state.winner || depth <= 0) return boardScore(state, bot);
  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0) return boardScore(state, bot);
  if (state.turn === bot) {
    return Math.max(...orderedMoves(state, legalMoves).map((move) => {
      const result = applyGameMove(state, state.turn, move);
      return result.ok ? evaluateState(result.state, bot, depth - 1) : Number.NEGATIVE_INFINITY;
    }));
  }
  return Math.min(...orderedMoves(state, legalMoves).map((move) => {
    const result = applyGameMove(state, state.turn, move);
    return result.ok ? evaluateState(result.state, bot, depth - 1) : Number.POSITIVE_INFINITY;
  }));
}

function boardScore(state: GameState, bot: PlayerMark): number {
  if (state.winner === bot) return 1_000_000 + (1000 - state.moveCount);
  if (state.winner === otherPlayer(bot)) return -1_000_000 - (1000 - state.moveCount);
  if (state.winner === "draw") return 0;

  if (state.gameId === "dots-and-boxes") {
    const scores = state.meta?.dots?.scores ?? emptyPlayerNumbers();
    return (scores[bot] - scores[otherPlayer(bot)]) * 500;
  }
  if (state.gameId === "mancala") {
    const meta = state.meta?.mancala;
    return meta ? (meta.stores[bot] - meta.stores[otherPlayer(bot)]) * 300 : 0;
  }
  if (state.gameId === "battleship") {
    const shots = bot === "p1" ? state.meta?.battleship?.humanShots : state.meta?.battleship?.botShots;
    return Object.values(shots ?? {}).filter((shot) => shot === "hit").length * 200;
  }
  if (state.gameId === "last-card") {
    const meta = state.meta?.lastCard;
    return meta ? (meta.handCounts[otherPlayer(bot)] - meta.handCounts[bot]) * 350 : 0;
  }
  if (state.gameId === "darts") {
    const meta = state.meta?.darts;
    return meta ? (meta.scores[otherPlayer(bot)] - meta.scores[bot]) * 20 : 0;
  }
  if (state.gameId === "word-hunt") {
    const meta = state.meta?.wordHunt;
    return meta ? (meta.scores[bot] - meta.scores[otherPlayer(bot)]) * 120 : 0;
  }
  if (state.gameId === "cup-pong") {
    const meta = state.meta?.cupPong;
    return meta ? (meta.cups[otherPlayer(bot)].filter(Boolean).length * -120) + meta.made[bot] * 80 : 0;
  }
  if (state.gameId === "dominoes") {
    const meta = state.meta?.dominoes;
    if (!meta) return 0;
    const normalized = normalizeDominoMeta(meta);
    const opponentMarks = normalized.playerOrder.filter((mark) => mark !== bot);
    const ownPips = normalized.pipCounts[bot];
    const opponentPips = opponentMarks.reduce((sum, mark) => sum + normalized.pipCounts[mark], 0);
    return (opponentPips - ownPips) * 25 - normalized.handCounts[bot] * 80 + normalized.scores[bot] * 12;
  }
  if (state.gameId === "four-in-a-row") return fourInARowScore(state, bot);

  const opponent = otherPlayer(bot);
  return (
    lineScore(state, bot) -
    lineScore(state, opponent) * 1.08 +
    centerScore(state, bot) -
    centerScore(state, opponent) +
    pieceScore(state, bot) -
    pieceScore(state, opponent)
  );
}

function lineScore(state: GameState, player: PlayerMark): number {
  let score = 0;
  for (let row = 0; row < state.board.length; row += 1) {
    for (let column = 0; column < state.board[0].length; column += 1) {
      if (state.board[row][column] !== player) continue;
      for (const direction of DIRECTIONS) {
        const before = { row: row - direction.row, column: column - direction.column };
        if (cellAt(state.board, before) === player) continue;
        let count = 0;
        let cursor = { row, column };
        while (cellAt(state.board, cursor) === player) {
          count += 1;
          cursor = { row: cursor.row + direction.row, column: cursor.column + direction.column };
        }
        const openEnds = Number(cellAt(state.board, before) === null) + Number(cellAt(state.board, cursor) === null);
        score += sequenceScore(count, openEnds);
      }
    }
  }
  return score;
}

function sequenceScore(count: number, openEnds: number): number {
  if (count >= 5) return 900_000;
  if (count === 4) return openEnds === 2 ? 120_000 : 55_000;
  if (count === 3) return openEnds === 2 ? 14_000 : 4_000;
  if (count === 2) return openEnds === 2 ? 1_100 : 260;
  return openEnds === 2 ? 40 : 10;
}

function centerScore(state: GameState, player: PlayerMark): number {
  const centerRow = (state.board.length - 1) / 2;
  const centerColumn = (state.board[0].length - 1) / 2;
  return state.board.reduce((total, row, rowIndex) => total + row.reduce((rowTotal, cell, columnIndex) => {
    if (cell !== player) return rowTotal;
    const distance = Math.abs(rowIndex - centerRow) + Math.abs(columnIndex - centerColumn);
    return rowTotal + Math.max(0, 24 - distance * 3);
  }, 0), 0);
}

function pieceScore(state: GameState, player: PlayerMark): number {
  let score = state.board.flat().filter((cell) => cell === player).length * 80;
  if (state.gameId === "checkers") {
    score += (state.meta?.checkers?.kings ?? []).filter((key) => cellAt(state.board, pointFromKey(key)) === player).length * 90;
  }
  return score;
}

function orderedMoves(state: GameState, moves: GameMove[]): GameMove[] {
  const centerColumn = (state.board[0].length - 1) / 2;
  const centerRow = (state.board.length - 1) / 2;
  return [...moves].sort((a, b) => {
    const aDistance = Math.abs((a.row ?? centerRow) - centerRow) + Math.abs(a.column - centerColumn);
    const bDistance = Math.abs((b.row ?? centerRow) - centerRow) + Math.abs(b.column - centerColumn);
    return aDistance - bDistance;
  });
}

function reversiFlips(board: Cell[][], point: BoardPoint, player: PlayerMark): BoardPoint[] {
  if (cellAt(board, point)) return [];
  const opponent = otherPlayer(player);
  const flips: BoardPoint[] = [];
  for (const direction of [...DIRECTIONS, { row: -1, column: 0 }, { row: 0, column: -1 }, { row: -1, column: -1 }, { row: -1, column: 1 }]) {
    const line: BoardPoint[] = [];
    let cursor = { row: point.row + direction.row, column: point.column + direction.column };
    while (cellAt(board, cursor) === opponent) {
      line.push(cursor);
      cursor = { row: cursor.row + direction.row, column: cursor.column + direction.column };
    }
    if (line.length > 0 && cellAt(board, cursor) === player) flips.push(...line);
  }
  return flips;
}

function completedBoxes(meta: DotsMeta, edge: "h" | "v", row: number, column: number): BoardPoint[] {
  const boxes: BoardPoint[] = [];
  const check = (boxRow: number, boxColumn: number) => {
    if (boxRow < 0 || boxRow >= meta.size || boxColumn < 0 || boxColumn >= meta.size) return;
    if (
      meta.hEdges[boxRow][boxColumn] &&
      meta.hEdges[boxRow + 1][boxColumn] &&
      meta.vEdges[boxRow][boxColumn] &&
      meta.vEdges[boxRow][boxColumn + 1]
    ) {
      boxes.push({ row: boxRow, column: boxColumn });
    }
  };
  if (edge === "h") {
    check(row - 1, column);
    check(row, column);
  } else {
    check(row, column - 1);
    check(row, column);
  }
  return boxes;
}

function countWinner(board: Cell[][]): Winner {
  const p1 = board.flat().filter((cell) => cell === "p1").length;
  const p2 = board.flat().filter((cell) => cell === "p2").length;
  return p1 === p2 ? "draw" : p1 > p2 ? "p1" : "p2";
}

function hexPath(board: Cell[][], player: PlayerMark): BoardPoint[] {
  const queue: BoardPoint[] = [];
  const cameFrom = new Map<string, string | null>();
  for (let i = 0; i < board.length; i += 1) {
    const point = player === "p1" ? { row: i, column: 0 } : { row: 0, column: i };
    if (cellAt(board, point) === player) {
      queue.push(point);
      cameFrom.set(keyOf(point), null);
    }
  }

  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    const finished = player === "p1" ? point.column === board[0].length - 1 : point.row === board.length - 1;
    if (finished) return rebuildPath(point, cameFrom);
    for (const delta of HEX_DIRECTIONS) {
      const next = { row: point.row + delta.row, column: point.column + delta.column };
      const key = keyOf(next);
      if (cellAt(board, next) === player && !cameFrom.has(key)) {
        cameFrom.set(key, keyOf(point));
        queue.push(next);
      }
    }
  }
  return [];
}

function rebuildPath(end: BoardPoint, cameFrom: Map<string, string | null>): BoardPoint[] {
  const path: BoardPoint[] = [];
  let cursor: string | null = keyOf(end);
  while (cursor) {
    path.push(pointFromKey(cursor));
    cursor = cameFrom.get(cursor) ?? null;
  }
  return path.reverse();
}

function localCells(state: GameState, board: Cell[][], mini: number): Cell[] {
  const localSize = ultimateLocalSize(state);
  const startRow = Math.floor(mini / localSize) * localSize;
  const startColumn = (mini % localSize) * localSize;
  const cells: Cell[] = [];
  for (let row = startRow; row < startRow + localSize; row += 1) {
    for (let column = startColumn; column < startColumn + localSize; column += 1) cells.push(board[row][column]);
  }
  return cells;
}

function findLocalTicLine(state: GameState, board: Cell[][], mini: number, player: PlayerMark): BoardPoint[] {
  const localSize = ultimateLocalSize(state);
  const startRow = Math.floor(mini / localSize) * localSize;
  const startColumn = (mini % localSize) * localSize;
  const lines = squareLines(localSize);
  for (const line of lines) {
    const points = line.map((index) => ({ row: startRow + Math.floor(index / localSize), column: startColumn + (index % localSize) }));
    if (points.every((point) => cellAt(board, point) === player)) return points;
  }
  return [];
}

function findMetaLine(localWinners: Winner[], player: PlayerMark, localSize: number): number[] {
  const lines = squareLines(localSize);
  return lines.find((line) => line.every((index) => localWinners[index] === player)) ?? [];
}

function miniCenterPoints(state: GameState, mini: number): BoardPoint[] {
  const localSize = ultimateLocalSize(state);
  const offset = Math.floor(localSize / 2);
  return [{ row: Math.floor(mini / localSize) * localSize + offset, column: (mini % localSize) * localSize + offset }];
}

function ultimateBoardIndex(state: GameState, row: number, column: number): number {
  const localSize = ultimateLocalSize(state);
  return Math.floor(row / localSize) * localSize + Math.floor(column / localSize);
}

function ultimateLocalIndex(state: GameState, row: number, column: number): number {
  const localSize = ultimateLocalSize(state);
  return (row % localSize) * localSize + (column % localSize);
}

function squareLines(size: number): number[][] {
  const lines: number[][] = [];
  for (let row = 0; row < size; row += 1) {
    lines.push(Array.from({ length: size }, (_, column) => row * size + column));
  }
  for (let column = 0; column < size; column += 1) {
    lines.push(Array.from({ length: size }, (_, row) => row * size + column));
  }
  lines.push(Array.from({ length: size }, (_, index) => index * size + index));
  lines.push(Array.from({ length: size }, (_, index) => index * size + (size - 1 - index)));
  return lines;
}

function formsMill(board: Cell[][], point: BoardPoint, player: PlayerMark): boolean {
  const key = keyOf(point);
  return MORRIS_MILLS.some((mill) => mill.includes(key) && mill.every((millKey) => cellAt(board, pointFromKey(millKey)) === player));
}

function removableMorrisPieces(board: Cell[][], opponent: PlayerMark): BoardPoint[] {
  const removable = [...MORRIS_POINTS]
    .map(pointFromKey)
    .filter((point) => cellAt(board, point) === opponent && !formsMill(board, point, opponent));
  const fallback = [...MORRIS_POINTS].map(pointFromKey).filter((point) => cellAt(board, point) === opponent);
  return removable.length > 0 ? removable : fallback;
}

function makeFleetShips(): BattleshipShip[] {
  const specs: Array<Omit<BattleshipShip, "cells" | "orientation">> = [
    { id: "carrier", name: "Carrier", size: 5 },
    { id: "battleship", name: "Battleship", size: 4 },
    { id: "cruiser", name: "Cruiser", size: 3 },
    { id: "submarine", name: "Submarine", size: 3 },
    { id: "patrol", name: "Patrol Boat", size: 2 }
  ];
  const occupied = new Set<string>();
  const fleet: BattleshipShip[] = [];

  for (const spec of specs) {
    const placement = placeBattleshipSpec(spec.size, occupied);
    placement.cells.forEach((cell) => occupied.add(keyOf(cell)));
    fleet.push({ ...spec, orientation: placement.orientation, cells: placement.cells });
  }

  return fleet;
}

function placeBattleshipSpec(
  size: number,
  occupied: Set<string>
): { orientation: BattleshipShip["orientation"]; cells: BattleshipShot[] } {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const orientation: BattleshipShip["orientation"] = Math.random() < 0.5 ? "horizontal" : "vertical";
    const row = Math.floor(Math.random() * (orientation === "vertical" ? 11 - size : 10));
    const column = Math.floor(Math.random() * (orientation === "horizontal" ? 11 - size : 10));
    const cells = Array.from({ length: size }, (_, index) => ({
      row: row + (orientation === "vertical" ? index : 0),
      column: column + (orientation === "horizontal" ? index : 0)
    }));
    if (cells.every((cell) => !occupied.has(keyOf(cell)))) return { orientation, cells };
  }

  for (const orientation of ["horizontal", "vertical"] as const) {
    for (let row = 0; row < 10; row += 1) {
      for (let column = 0; column < 10; column += 1) {
        const cells = Array.from({ length: size }, (_, index) => ({
          row: row + (orientation === "vertical" ? index : 0),
          column: column + (orientation === "horizontal" ? index : 0)
        }));
        if (cells.some((cell) => cell.row >= 10 || cell.column >= 10 || occupied.has(keyOf(cell)))) continue;
        return { orientation, cells };
      }
    }
  }

  return { orientation: "horizontal", cells: [] };
}

function flattenFleet(fleet: BattleshipShip[]): BattleshipShot[] {
  return fleet.flatMap((ship) => ship.cells);
}

function createDartsMeta(variant: BoardVariant): DartsMeta {
  const targetScore = variant === "wide" ? 501 : 301;
  return {
    targetScore,
    scores: { p1: targetScore, p2: targetScore, p3: targetScore, p4: targetScore },
    dartsLeft: 3,
    turnScore: 0,
    throws: []
  };
}

function createWordHuntMeta(variant: BoardVariant): WordHuntMeta {
  const size = variant === "wide" ? 5 : 4;
  const seed = Math.random().toString(36).slice(2, 10);
  const random = seededRandom(seed);
  const candidates = shuffleWithRandom(WORD_HUNT_BANK.filter((word) => word.length <= size + 1), random)
    .slice(0, size === 5 ? 12 : 9);
  const letters = Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
  for (const word of candidates) {
    placeWordOnGrid(letters, word, random);
  }
  const alphabet = "EEEEAAAARRRIIOOTTTNNSSLLCCUUDDPPMMGGHHBBFFYYKWVXZ";
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (!letters[row][column]) {
        letters[row][column] = alphabet[Math.floor(random() * alphabet.length)];
      }
    }
  }
  const words = WORD_HUNT_BANK
    .filter((word) => word.length >= 3 && word.length <= size * size && wordCanBeMade(letters, word))
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  return {
    size,
    letters,
    words,
    found: emptyPlayerStringLists(),
    scores: emptyPlayerNumbers(),
    seed,
    roundStartedAt: Date.now(),
    durationMs: size === 5 ? WORD_HUNT_WIDE_DURATION_MS : WORD_HUNT_CLASSIC_DURATION_MS
  };
}

function createCupPongMeta(variant: BoardVariant): CupPongMeta {
  return createCupPongTableMeta(variant);
}

function createLastCardMeta(): LastCardMeta {
  const deck = shuffleLastCards(makeLastCardDeck());
  const hands: Record<PlayerMark, LastCardCard[]> = {
    p1: deck.splice(0, LAST_CARD_HAND_SIZE),
    p2: deck.splice(0, LAST_CARD_HAND_SIZE),
    p3: [],
    p4: []
  };
  const firstCardIndex = deck.findIndex((card) => LAST_CARD_NUMBER_RANKS.includes(card.rank));
  const [firstCard] = deck.splice(firstCardIndex >= 0 ? firstCardIndex : 0, 1);
  const meta: LastCardMeta = {
    deck,
    deckCount: deck.length,
    discard: [firstCard],
    hands,
    handCounts: { p1: hands.p1.length, p2: hands.p2.length, p3: 0, p4: 0 },
    currentColor: firstCard.color === "wild" ? "red" : firstCard.color
  };
  return syncLastCardHandCounts(meta);
}

function makeLastCardDeck(): LastCardCard[] {
  const deck: LastCardCard[] = [];
  for (const color of LAST_CARD_COLORS) {
    deck.push({ id: `${color}-0-a`, color, rank: "0" });
    for (const rank of LAST_CARD_NUMBER_RANKS.slice(1)) {
      deck.push({ id: `${color}-${rank}-a`, color, rank });
      deck.push({ id: `${color}-${rank}-b`, color, rank });
    }
    for (const rank of LAST_CARD_ACTION_RANKS) {
      deck.push({ id: `${color}-${rank}-a`, color, rank });
      deck.push({ id: `${color}-${rank}-b`, color, rank });
    }
  }
  for (let index = 0; index < 4; index += 1) {
    deck.push({ id: `wild-wild-${index}`, color: "wild", rank: LAST_CARD_WILD_RANKS[0] });
    deck.push({ id: `wild-wild4-${index}`, color: "wild", rank: LAST_CARD_WILD_RANKS[1] });
  }
  return deck;
}

function shuffleLastCards(cards: LastCardCard[]): LastCardCard[] {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function lastCardTop(meta: LastCardMeta): LastCardCard | undefined {
  return meta.discard.at(-1);
}

function isLastCardPlayable(
  card: LastCardCard,
  top: LastCardCard,
  currentColor: LastCardActiveColor,
  hand: LastCardCard[] = []
): boolean {
  if (card.rank === "wild4" && hand.some((candidate) => candidate !== card && candidate.color === currentColor)) {
    return false;
  }
  return card.color === "wild" || card.color === currentColor || card.rank === top.rank;
}

function getPlayableLastCardIndexes(meta: LastCardMeta, player: PlayerMark): number[] {
  const top = lastCardTop(meta);
  if (!top) return [];
  return meta.hands[player]
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => isLastCardPlayable(card, top, meta.currentColor, meta.hands[player]))
    .map(({ index }) => index);
}

function canDrawLastCard(meta: LastCardMeta): boolean {
  return meta.deck.length > 0 || meta.discard.length > 1;
}

function drawLastCards(meta: LastCardMeta, player: PlayerMark, count: number): number {
  let drawn = 0;
  while (drawn < count) {
    if (meta.deck.length === 0) reshuffleLastCards(meta);
    const card = meta.deck.pop();
    if (!card) break;
    meta.hands[player].push(card);
    drawn += 1;
  }
  syncLastCardHandCounts(meta);
  return drawn;
}

function reshuffleLastCards(meta: LastCardMeta): void {
  const top = lastCardTop(meta);
  if (!top || meta.discard.length <= 1) return;
  meta.deck = shuffleLastCards(meta.discard.slice(0, -1));
  meta.discard = [top];
}

function syncLastCardHandCounts(meta: LastCardMeta): LastCardMeta {
  meta.handCounts = {
    p1: meta.hands.p1.length,
    p2: meta.hands.p2.length,
    p3: meta.hands.p3?.length ?? 0,
    p4: meta.hands.p4?.length ?? 0
  };
  meta.deckCount = meta.deck.length;
  return meta;
}

function lastCardMoveScore(
  meta: LastCardMeta,
  player: PlayerMark,
  move: GameMove,
  difficulty: BotDifficulty
): number {
  const card = meta.hands[player][move.column];
  if (!card) return Number.NEGATIVE_INFINITY;

  const opponent = otherPlayer(player);
  const remainingHand = meta.hands[player].filter((_, index) => index !== move.column);
  const sameColorLeft = card.color === "wild"
    ? bestLastCardColorCount(remainingHand)
    : remainingHand.filter((candidate) => candidate.color === card.color).length;
  const sameRankLeft = remainingHand.filter((candidate) => candidate.rank === card.rank).length;
  const opponentPressure = Math.max(0, 4 - meta.hands[opponent].length) * 18;
  const actionScore = card.rank === "wild4"
    ? 138 + opponentPressure
    : card.rank === "draw2"
      ? 110 + opponentPressure
      : card.rank === "skip" || card.rank === "reverse"
        ? 72 + opponentPressure
        : card.rank === "wild"
          ? 44
          : 0;

  return (
    actionScore +
    sameColorLeft * (difficulty === "casual" ? 10 : 18) +
    sameRankLeft * 8 +
    lastCardRankScore(card.rank) +
    (card.color === meta.currentColor ? 9 : card.color === "wild" ? 13 : 0) -
    remainingHand.length * 2
  );
}

function lastCardRankScore(rank: LastCardRank): number {
  if (rank === "wild4") return 32;
  if (rank === "draw2") return 24;
  if (rank === "skip" || rank === "reverse") return 18;
  if (rank === "wild") return 16;
  return Number(rank);
}

function chooseLastCardColor(hand: LastCardCard[]): LastCardActiveColor {
  return LAST_CARD_COLORS
    .map((color) => ({
      color,
      count: hand.filter((card) => card.color === color).length
    }))
    .sort((a, b) => b.count - a.count)[0].color;
}

function bestLastCardColorCount(hand: LastCardCard[]): number {
  return Math.max(0, ...LAST_CARD_COLORS.map((color) => hand.filter((card) => card.color === color).length));
}

function emptyPlayerNumbers(value = 0): Record<PlayerMark, number> {
  return { p1: value, p2: value, p3: value, p4: value };
}

function emptyPlayerStringLists(): Record<PlayerMark, string[]> {
  return { p1: [], p2: [], p3: [], p4: [] };
}

function dartsTargetFromMove(move: GameMove): DartsTarget | null {
  if (move.column === DARTS_MISS_COLUMN || move.row === 0) return { label: "Miss", value: 0, multiplier: 0 };
  if (move.column === DARTS_BULL_INDEX) return { label: "Bull", value: 25, multiplier: 1 };
  if (move.column === DARTS_BULL_INDEX + 1) return { label: "Double Bull", value: 50, multiplier: 2 };
  const segment = DARTS_SEGMENTS[move.column];
  const multiplier = move.row === 3 ? 3 : move.row === 2 ? 2 : 1;
  if (!segment || !Number.isInteger(multiplier)) return null;
  return {
    label: `${multiplier === 3 ? "T" : multiplier === 2 ? "D" : "S"}${segment}`,
    value: segment * multiplier,
    multiplier
  };
}

function cleanWord(value: string | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 16);
}

function normalizeWordHuntMeta(meta: WordHuntMeta | undefined): WordHuntMeta | undefined {
  if (!meta) return undefined;
  meta.roundStartedAt ||= Date.now();
  meta.durationMs ||= meta.size === 5 ? WORD_HUNT_WIDE_DURATION_MS : WORD_HUNT_CLASSIC_DURATION_MS;
  meta.found ||= emptyPlayerStringLists();
  meta.scores ||= emptyPlayerNumbers();
  return meta;
}

function wordHuntTimeRemaining(meta: WordHuntMeta, now = Date.now()): number {
  return Math.max(0, meta.roundStartedAt + meta.durationMs - now);
}

function wordHuntActiveMarks(state: GameState): PlayerMark[] {
  const marks = state.gameId === "word-hunt"
    ? state.boardVariant === "party" ? PLAYER_ORDER : (["p1", "p2"] as PlayerMark[])
    : (["p1", "p2"] as PlayerMark[]);
  return marks.filter((mark) => state.meta?.wordHunt?.scores[mark] !== undefined);
}

function wordCanBeMade(letters: string[][], word: string): boolean {
  if (!word || letters.length === 0) return false;
  const rows = letters.length;
  const columns = letters[0]?.length ?? 0;
  const directions = [-1, 0, 1].flatMap((rowDelta) =>
    [-1, 0, 1].map((columnDelta) => ({ rowDelta, columnDelta }))
  ).filter((direction) => direction.rowDelta !== 0 || direction.columnDelta !== 0);

  const visit = (row: number, column: number, index: number, used: Set<string>): boolean => {
    if (row < 0 || row >= rows || column < 0 || column >= columns) return false;
    const key = `${row},${column}`;
    if (used.has(key) || letters[row][column] !== word[index]) return false;
    if (index === word.length - 1) return true;
    used.add(key);
    const found = directions.some(({ rowDelta, columnDelta }) =>
      visit(row + rowDelta, column + columnDelta, index + 1, used)
    );
    used.delete(key);
    return found;
  };

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (visit(row, column, 0, new Set())) return true;
    }
  }
  return false;
}

function wordScore(word: string): number {
  return word.length <= 3 ? 1 : word.length === 4 ? 2 : word.length === 5 ? 4 : word.length + 1;
}

function highestScoreWinner(scores: Record<PlayerMark, number>, marks: PlayerMark[]): Winner {
  const ranked = [...marks].sort((a, b) => scores[b] - scores[a]);
  return scores[ranked[0]] === scores[ranked[1]] ? "draw" : ranked[0];
}

function seededRandom(seed: string): () => number {
  let value = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 2166136261);
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) % 1_000_000) / 1_000_000;
  };
}

function shuffleWithRandom<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function placeWordOnGrid(letters: string[][], word: string, random: () => number): boolean {
  const size = letters.length;
  const directions = shuffleWithRandom([
    { row: 0, column: 1 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: -1, column: 1 }
  ], random);
  const starts = shuffleWithRandom(
    Array.from({ length: size * size }, (_, index) => ({ row: Math.floor(index / size), column: index % size })),
    random
  );
  for (const start of starts) {
    for (const direction of directions) {
      const points = Array.from({ length: word.length }, (_, index) => ({
        row: start.row + direction.row * index,
        column: start.column + direction.column * index
      }));
      if (points.some((point) => point.row < 0 || point.row >= size || point.column < 0 || point.column >= size)) continue;
      if (points.some((point, index) => letters[point.row][point.column] && letters[point.row][point.column] !== word[index])) continue;
      points.forEach((point, index) => {
        letters[point.row][point.column] = word[index];
      });
      return true;
    }
  }
  return false;
}

function addUniquePlayer(values: PlayerMark[], value: PlayerMark): void {
  if (!values.includes(value)) values.push(value);
}

export function maskGameMetaForPlayer(meta: GameMeta | undefined, player?: PlayerMark): GameMeta | undefined {
  if (!meta?.lastCard && !meta?.dominoes && !meta?.battleship) return meta;

  const next = JSON.parse(JSON.stringify(meta)) as GameMeta;
  if (meta.battleship && next.battleship) {
    const battleship = next.battleship;
    const sunkBotFleet = meta.battleship.botFleet.filter((ship) => isBattleshipSunkBy(ship, meta.battleship!.humanShots));
    const sunkPlayerFleet = meta.battleship.playerFleet.filter((ship) => isBattleshipSunkBy(ship, meta.battleship!.botShots));

    if (player === "p1") {
      battleship.botFleet = sunkBotFleet;
      battleship.botShips = flattenFleet(sunkBotFleet);
      battleship.playerFleet = meta.battleship.playerFleet;
      battleship.playerShips = meta.battleship.playerShips;
    } else if (player === "p2") {
      battleship.botFleet = meta.battleship.botFleet;
      battleship.botShips = meta.battleship.botShips;
      battleship.playerFleet = sunkPlayerFleet;
      battleship.playerShips = flattenFleet(sunkPlayerFleet);
    } else {
      battleship.botFleet = sunkBotFleet;
      battleship.botShips = flattenFleet(sunkBotFleet);
      battleship.playerFleet = sunkPlayerFleet;
      battleship.playerShips = flattenFleet(sunkPlayerFleet);
    }
  }
  if (meta.lastCard && next.lastCard) {
    const lastCard = next.lastCard;
    const counts = {
      p1: meta.lastCard.handCounts?.p1 ?? meta.lastCard.hands.p1.length,
      p2: meta.lastCard.handCounts?.p2 ?? meta.lastCard.hands.p2.length,
      p3: meta.lastCard.handCounts?.p3 ?? meta.lastCard.hands.p3?.length ?? 0,
      p4: meta.lastCard.handCounts?.p4 ?? meta.lastCard.hands.p4?.length ?? 0
    };
    lastCard.handCounts = counts;
    lastCard.deckCount = meta.lastCard.deckCount ?? meta.lastCard.deck.length;
    lastCard.deck = [];
    lastCard.hands = {
      p1: player === "p1" ? lastCard.hands.p1 : [],
      p2: player === "p2" ? lastCard.hands.p2 : [],
      p3: player === "p3" ? lastCard.hands.p3 ?? [] : [],
      p4: player === "p4" ? lastCard.hands.p4 ?? [] : []
    };
  }
  if (meta.dominoes && next.dominoes) {
    next.dominoes = maskDominoMetaForPlayer(normalizeDominoMeta(meta.dominoes), player as DominoPlayerMark | undefined);
  }
  return next;
}

function isBattleshipSunkBy(ship: BattleshipShip, shots: Record<string, "hit" | "miss">): boolean {
  return ship.cells.every((cell) => shots[keyOf(cell)] === "hit");
}

function isMorrisPoint(point: BoardPoint): boolean {
  return MORRIS_POINTS.has(keyOf(point));
}

function countPieces(board: Cell[][], player: PlayerMark): number {
  return board.flat().filter((cell) => cell === player).length;
}

function hasNeighbor(board: Cell[][], row: number, column: number, radius: number): boolean {
  for (let nextRow = Math.max(0, row - radius); nextRow <= Math.min(board.length - 1, row + radius); nextRow += 1) {
    for (let nextColumn = Math.max(0, column - radius); nextColumn <= Math.min(board[0].length - 1, column + radius); nextColumn += 1) {
      if (nextRow === row && nextColumn === column) continue;
      if (board[nextRow][nextColumn]) return true;
    }
  }
  return false;
}

function cellAt(board: Cell[][], point: BoardPoint): Cell | undefined {
  return board[point.row]?.[point.column];
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => [...row]);
}

function cloneMeta(state: GameState): GameMeta {
  return state.meta ? JSON.parse(JSON.stringify(state.meta)) as GameMeta : {};
}

function cloneDotsMeta(meta: DotsMeta): DotsMeta {
  return JSON.parse(JSON.stringify(meta)) as DotsMeta;
}

function keyOf(point: BoardPoint): string {
  return `${point.row},${point.column}`;
}

function pointFromKey(key: string): BoardPoint {
  const [row, column] = key.split(",").map(Number);
  return { row, column };
}

function otherPlayer(player: PlayerMark): PlayerMark {
  return player === "p1" ? "p2" : "p1";
}
