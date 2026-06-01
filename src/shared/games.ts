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
  | "flappy-bird"
  | "snake"
  | "twenty-forty-eight";
export type PlayerMark = "p1" | "p2";
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
}

export interface DotsMeta {
  size: number;
  hEdges: boolean[][];
  vEdges: boolean[][];
  scores: Record<PlayerMark, number>;
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

export interface GameMeta {
  ultimate?: UltimateMeta;
  dots?: DotsMeta;
  checkers?: CheckersMeta;
  battleship?: BattleshipMeta;
  mancala?: MancalaMeta;
  morris?: MorrisMeta;
}

export interface GameDefinition {
  id: GameId;
  name: string;
  rows: number;
  columns: number;
  connectLength: number;
  moveMode: "drop-column" | "place-cell" | "custom";
  playerNames: Record<PlayerMark, string>;
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

export const GAME_IDS = Object.keys(DEFINITIONS) as GameId[];

export function getGameDefinition(gameId: GameId): GameDefinition {
  return DEFINITIONS[gameId];
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

  const winningMove = findImmediateWinningMove(state, player, legalMoves);
  if (winningMove) return winningMove;

  const opponent = otherPlayer(player);
  const blockingMove = findImmediateWinningMove({ ...state, turn: opponent }, opponent, legalMoves);
  if (blockingMove && state.gameId !== "battleship") return blockingMove;

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
        scores: { p1: 0, p2: 0 }
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
        pits: { p1: [4, 4, 4, 4, 4, 4], p2: [4, 4, 4, 4, 4, 4] },
        stores: { p1: 0, p2: 0 }
      }
    };
  }

  if (gameId === "nine-mens-morris") {
    return { morris: { placed: { p1: 0, p2: 0 }, removed: { p1: 0, p2: 0 } } };
  }

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
    const scores = state.meta?.dots?.scores ?? { p1: 0, p2: 0 };
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

function removeMorrisPiece(board: Cell[][], meta: MorrisMeta, opponent: PlayerMark): void {
  const removable = [...MORRIS_POINTS]
    .map(pointFromKey)
    .filter((point) => cellAt(board, point) === opponent && !formsMill(board, point, opponent));
  const fallback = [...MORRIS_POINTS].map(pointFromKey).filter((point) => cellAt(board, point) === opponent);
  const target = removable[0] ?? fallback[0];
  if (target) {
    board[target.row][target.column] = null;
    meta.removed[opponent] += 1;
  }
}

function makeFleetShips(offset: number): BattleshipShip[] {
  const ships: Array<Omit<BattleshipShip, "cells"> & { row: number; column: number }> = [
    { id: "carrier", name: "Carrier", size: 5, orientation: "horizontal", row: 0, column: offset },
    { id: "battleship", name: "Battleship", size: 4, orientation: "vertical", row: 2, column: offset + 1 },
    { id: "cruiser", name: "Cruiser", size: 3, orientation: "horizontal", row: 5, column: offset },
    { id: "submarine", name: "Submarine", size: 3, orientation: "vertical", row: 7, column: offset + 3 },
    { id: "patrol", name: "Patrol Boat", size: 2, orientation: "horizontal", row: 9, column: offset }
  ];

  return ships.map(({ row, column, ...ship }) => ({
    ...ship,
    cells: Array.from({ length: ship.size }, (_, index) => ({
      row: row + (ship.orientation === "vertical" ? index : 0),
      column: (column + (ship.orientation === "horizontal" ? index : 0)) % 10
    }))
  }));
}

function flattenFleet(fleet: BattleshipShip[]): BattleshipShot[] {
  return fleet.flatMap((ship) => ship.cells);
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
