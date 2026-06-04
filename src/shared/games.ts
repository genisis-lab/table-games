import {
  applyDominoIntent,
  chooseDominoBotMove,
  createDominoMeta as createDominoTableMeta,
  getDominoLegalMoves,
  maskDominoMetaForPlayer,
  normalizeDominoMeta
} from "../games/domino/engine";
import type { DominoMeta, DominoPlayerMark, DominoTile } from "../games/domino/engine";

export type { DominoMeta, DominoTile } from "../games/domino/engine";

import {
  applyCupPongIntent,
  chooseCupPongBotMove,
  createCupPongMeta as createCupPongTableMeta,
  getCupPongLegalMoves,
  normalizeCupPongMeta
} from "../games/cup-pong/engine";
import type { CupPongMeta, CupPongPlayerMark } from "../games/cup-pong/engine";

export type { CupPongMeta } from "../games/cup-pong/engine";

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
}

export interface UltimateMeta {
  localWinners: Winner[];
  activeBoard: number | null;
}

export interface CheckersMeta {
  kings: string[];
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
  lastDraw?: { player: PlayerMark; count: number };
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
    name: "Battleship",
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
    name: "Uno",
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
    name: "Flappy Bird",
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
const WORD_HUNT_BANK = [
  "SPARK", "TABLE", "BOARD", "TOKEN", "MATCH", "STONE", "CROWN", "ARROW", "QUEST", "LUCK",
  "RACK", "CUP", "DART", "BIRD", "GRID", "LINE", "SWAP", "FIRE", "CHAT", "SCORE",
  "PLAY", "TURN", "WILD", "HIT", "SHIP", "DOMINO", "PONG", "WORD", "HUNT", "NIGHT",
  "PARTY", "DUEL", "BOT", "WIN", "MOVE", "DROP", "FLIP", "JUMP", "KING", "FIVE",
  "FOUR", "THREE", "RUSH", "RING", "BULL", "CLOSE", "STACK", "BRIDGE", "MILL", "SEAT"
];
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

export function applyGameMove(
  state: GameState,
  player: PlayerMark,
  move: GameMove
): MoveResult {
  if (state.winner) return { ok: false, state, reason: "This game is already over." };
  if (player !== state.turn) return { ok: false, state, reason: "It is not your turn." };

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

  if (state.gameId === "tic-tac-toe" && difficulty === "ruthless") {
    return state.board.length === 3
      ? chooseByMinimax(state, player, legalMoves, 9)
      : chooseBySearch({ ...state, turn: player }, player, legalMoves, 2);
  }

  if (state.gameId === "battleship") return legalMoves[Math.floor(Math.random() * legalMoves.length)];

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
    const botFleet = makeFleetShips(1);
    const playerFleet = makeFleetShips(6);
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
    return { morris: { placed: emptyPlayerNumbers(), removed: emptyPlayerNumbers() } };
  }

  if (gameId === "last-card") return { lastCard: createLastCardMeta() };

  if (gameId === "darts") return { darts: createDartsMeta(variant) };

  if (gameId === "word-hunt") return { wordHunt: createWordHuntMeta(variant) };

  if (gameId === "cup-pong") return { cupPong: createCupPongTableMeta(variant) };

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
  if (king || to.row === (player === "p1" ? 0 : 7)) meta.kings.push(keyOf(to));

  const opponent = otherPlayer(player);
  const winner = board.flat().includes(opponent) && getCheckersMoves({ ...state, board, meta: { ...cloneMeta(state), checkers: meta }, turn: opponent }, opponent).length > 0
    ? null
    : player;
  return okMove(state, board, player, to, {
    winner,
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

  if (formsMill(board, point, player)) removeMorrisPiece(board, meta, otherPlayer(player));

  const opponent = otherPlayer(player);
  const opponentPieces = countPieces(board, opponent);
  const winner = meta.placed[opponent] >= 9 && opponentPieces < 3 ? player : null;
  return okMove(state, board, player, point, {
    winner,
    meta: { ...cloneMeta(state), morris: meta }
  });
}

function applyLastCardMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
  const clonedMeta = cloneMeta(state);
  const meta = clonedMeta.lastCard;
  const top = meta ? lastCardTop(meta) : undefined;
  if (!meta || !top) return { ok: false, state, reason: "The deck is not ready." };

  if (move.column === LAST_CARD_DRAW_MOVE) {
    const drawn = drawLastCards(meta, player, 1);
    if (drawn === 0) return { ok: false, state, reason: "The draw pile is empty." };

    meta.lastDraw = { player, count: drawn };
    delete meta.lastAction;
    syncLastCardHandCounts(meta);
    return {
      ok: true,
      point: { row: 0, column: LAST_CARD_DRAW_MOVE },
      state: {
        ...state,
        turn: otherPlayer(player),
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
  if (!isLastCardPlayable(card, top, meta.currentColor)) {
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
  const nextScore = previousScore - target.value;
  meta.throws = [...meta.throws, { player, label: target.label, score: target.value }].slice(-9);
  meta.dartsLeft -= 1;
  meta.turnScore += target.value;

  let nextTurn = player;
  let winner: Winner = null;
  if (nextScore === 0) {
    meta.scores[player] = 0;
    winner = player;
  } else if (nextScore < 0 || meta.dartsLeft <= 0) {
    if (nextScore > 0) meta.scores[player] = nextScore;
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
  const meta = clonedMeta.wordHunt;
  if (!meta) return { ok: false, state, reason: "The word grid is not ready." };

  const word = cleanWord(move.word);
  if (!word) return { ok: false, state, reason: "Enter a word from the grid." };
  if (!meta.words.includes(word)) return { ok: false, state, reason: "That word is not hiding on this board." };
  if (PLAYER_ORDER.some((mark) => meta.found[mark].includes(word))) {
    return { ok: false, state, reason: "That word was already found." };
  }

  meta.found[player].push(word);
  meta.scores[player] += wordScore(word);
  const foundCount = PLAYER_ORDER.reduce((count, mark) => count + meta.found[mark].length, 0);
  const winner = foundCount >= meta.words.length ? highestScoreWinner(meta.scores, ["p1", "p2"]) : null;

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
  const result = applyCupPongIntent(normalizeCupPongMeta(meta), player as CupPongPlayerMark, move);
  if (!result.ok) return { ok: false, state, reason: result.reason };

  return {
    ok: true,
    point: result.point,
    state: {
      ...state,
      turn: result.winner ? player : (result.nextTurn as PlayerMark),
      winner: result.winner as Winner,
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
  const moves: GameMove[] = [];
  const kings = state.meta?.checkers?.kings ?? [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      if (state.board[row][column] !== player) continue;
      const dirs = kings.includes(`${row},${column}`)
        ? [-1, 1]
        : [player === "p1" ? -1 : 1];
      for (const rowDir of dirs) {
        for (const columnDir of [-1, 1]) {
          const simple = { row: row + rowDir, column: column + columnDir };
          if (cellAt(state.board, simple) === null) moves.push({ row, column, toRow: simple.row, toColumn: simple.column });
          const jumped = { row: row + rowDir, column: column + columnDir };
          const landing = { row: row + rowDir * 2, column: column + columnDir * 2 };
          if (cellAt(state.board, jumped) === otherPlayer(player) && cellAt(state.board, landing) === null) {
            moves.push({ row, column, toRow: landing.row, toColumn: landing.column });
          }
        }
      }
    }
  }
  return moves;
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
  return canDrawLastCard(meta) ? [...playable, { column: LAST_CARD_DRAW_MOVE }] : playable;
}

function getDartsMoves(_state: GameState): GameMove[] {
  const segmentMoves = DARTS_SEGMENTS.flatMap((_, index) => [
    { row: 1, column: index },
    { row: 2, column: index },
    { row: 3, column: index }
  ]);
  return [...segmentMoves, { row: 25, column: DARTS_BULL_INDEX }, { row: 50, column: DARTS_BULL_INDEX + 1 }];
}

function getWordHuntMoves(state: GameState, player: PlayerMark): GameMove[] {
  const meta = state.meta?.wordHunt;
  if (!meta) return [];
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
      const exact = remaining === 0 ? 100_000 : 0;
      const bustPenalty = remaining < 0 ? -50_000 : 0;
      const pressure = Math.max(0, 80 - Math.abs(remaining)) * 4;
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
  if (difficulty === "casual") return chooseBySearch(state, player, legalMoves, 2);
  if (difficulty === "sharp") return chooseFourInARowBySearch(state, player, legalMoves, 4);

  return chooseFourInARowBySearch(state, player, legalMoves, 6);
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
  for (let row = 0; row < state.board.length; row += 1)