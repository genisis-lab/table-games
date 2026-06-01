export type GameId = "four-in-a-row" | "tic-tac-toe" | "gomoku";
export type PlayerMark = "p1" | "p2";
export type Winner = PlayerMark | "draw" | null;
export type Cell = PlayerMark | null;
export type BotDifficulty = "casual" | "sharp" | "ruthless";

export interface BoardPoint {
  row: number;
  column: number;
}

export interface GameMove {
  row?: number;
  column: number;
}

export interface GameDefinition {
  id: GameId;
  name: string;
  rows: number;
  columns: number;
  connectLength: number;
  moveMode: "drop-column" | "place-cell";
  playerNames: Record<PlayerMark, string>;
}

export interface GameState {
  gameId: GameId;
  board: Cell[][];
  turn: PlayerMark;
  winner: Winner;
  winningLine: BoardPoint[];
  moveCount: number;
}

export type MoveResult =
  | { ok: true; state: GameState; point: BoardPoint }
  | { ok: false; state: GameState; reason: string };

const DEFINITIONS: Record<GameId, GameDefinition> = {
  "four-in-a-row": {
    id: "four-in-a-row",
    name: "Four in a Row",
    rows: 6,
    columns: 7,
    connectLength: 4,
    moveMode: "drop-column",
    playerNames: { p1: "Red", p2: "Yellow" }
  },
  "tic-tac-toe": {
    id: "tic-tac-toe",
    name: "Tic Tac Toe",
    rows: 3,
    columns: 3,
    connectLength: 3,
    moveMode: "place-cell",
    playerNames: { p1: "X", p2: "O" }
  },
  gomoku: {
    id: "gomoku",
    name: "Gomoku",
    rows: 15,
    columns: 15,
    connectLength: 5,
    moveMode: "place-cell",
    playerNames: { p1: "Black", p2: "White" }
  }
};

const DIRECTIONS = [
  { row: 0, column: 1 },
  { row: 1, column: 0 },
  { row: 1, column: 1 },
  { row: 1, column: -1 }
] as const;

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

export function createGameState(gameId: GameId): GameState {
  const definition = getGameDefinition(gameId);

  return {
    gameId,
    board: Array.from({ length: definition.rows }, () =>
      Array.from<Cell>({ length: definition.columns }).fill(null)
    ),
    turn: "p1",
    winner: null,
    winningLine: [],
    moveCount: 0
  };
}

export function applyGameMove(
  state: GameState,
  player: PlayerMark,
  move: GameMove
): MoveResult {
  if (state.winner) {
    return { ok: false, state, reason: "This game is already over." };
  }

  if (player !== state.turn) {
    return { ok: false, state, reason: "It is not your turn." };
  }

  const definition = getGameDefinition(state.gameId);
  const target = resolveTarget(state, move);

  if (!target.ok) {
    return { ok: false, state, reason: target.reason };
  }

  const board = cloneBoard(state.board);
  board[target.point.row][target.point.column] = player;

  const winningLine = findWinningLine(board, target.point, player, definition);
  const moveCount = state.moveCount + 1;
  const winner = winningLine.length > 0
    ? player
    : moveCount === definition.rows * definition.columns
      ? "draw"
      : null;

  return {
    ok: true,
    point: target.point,
    state: {
      ...state,
      board,
      turn: player === "p1" ? "p2" : "p1",
      winner,
      winningLine,
      moveCount
    }
  };
}

export function getLegalMoves(state: GameState): GameMove[] {
  const definition = getGameDefinition(state.gameId);

  if (definition.moveMode === "drop-column") {
    return Array.from({ length: definition.columns }, (_, column) => ({ column }))
      .filter((move) => !state.board[0][move.column]);
  }

  const moves: GameMove[] = [];
  for (const [rowIndex, row] of state.board.entries()) {
    for (const [columnIndex, cell] of row.entries()) {
      if (!cell) moves.push({ row: rowIndex, column: columnIndex });
    }
  }

  if (state.gameId !== "gomoku" || state.moveCount === 0) {
    return state.gameId === "gomoku"
      ? [{ row: Math.floor(definition.rows / 2), column: Math.floor(definition.columns / 2) }]
      : moves;
  }

  const nearby = moves.filter((move) => hasNeighbor(state.board, move.row!, move.column, 2));
  return nearby.length > 0 ? nearby : moves;
}

export function chooseBotMove(
  state: GameState,
  player: PlayerMark,
  difficulty: BotDifficulty = "ruthless"
): GameMove | null {
  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0 || state.winner) return null;

  const winningMove = findImmediateWinningMove(state, player, legalMoves);
  if (winningMove) return winningMove;

  const opponent = otherPlayer(player);
  const blockingMove = findImmediateWinningMove({ ...state, turn: opponent }, opponent, legalMoves);
  if (blockingMove) return blockingMove;

  if (state.gameId === "tic-tac-toe" && difficulty === "ruthless") {
    return chooseByMinimax(state, player, legalMoves, 9);
  }

  const depth = difficulty === "casual" ? 1 : difficulty === "sharp" ? 2 : state.gameId === "gomoku" ? 2 : 4;
  return chooseBySearch(state, player, legalMoves, depth);
}

function resolveTarget(
  state: GameState,
  move: GameMove
): { ok: true; point: BoardPoint } | { ok: false; reason: string } {
  const definition = getGameDefinition(state.gameId);

  if (!Number.isInteger(move.column) || move.column < 0 || move.column >= definition.columns) {
    return { ok: false, reason: "That move is outside the board." };
  }

  if (definition.moveMode === "drop-column") {
    for (let row = definition.rows - 1; row >= 0; row -= 1) {
      if (!state.board[row][move.column]) {
        return { ok: true, point: { row, column: move.column } };
      }
    }

    return { ok: false, reason: "That column is full." };
  }

  if (
    !Number.isInteger(move.row) ||
    move.row === undefined ||
    move.row < 0 ||
    move.row >= definition.rows
  ) {
    return { ok: false, reason: "That move is outside the board." };
  }

  if (state.board[move.row][move.column]) {
    return { ok: false, reason: "That spot is already taken." };
  }

  return { ok: true, point: { row: move.row, column: move.column } };
}

function findWinningLine(
  board: Cell[][],
  point: BoardPoint,
  player: PlayerMark,
  definition: GameDefinition
): BoardPoint[] {
  for (const direction of DIRECTIONS) {
    const line = [
      ...walk(board, point, player, { row: -direction.row, column: -direction.column }).reverse(),
      point,
      ...walk(board, point, player, direction)
    ];

    if (line.length >= definition.connectLength) {
      return line.slice(0, definition.connectLength);
    }
  }

  return [];
}

function walk(
  board: Cell[][],
  point: BoardPoint,
  player: PlayerMark,
  delta: BoardPoint
): BoardPoint[] {
  const points: BoardPoint[] = [];
  let row = point.row + delta.row;
  let column = point.column + delta.column;

  while (
    row >= 0 &&
    row < board.length &&
    column >= 0 &&
    column < board[0].length &&
    board[row][column] === player
  ) {
    points.push({ row, column });
    row += delta.row;
    column += delta.column;
  }

  return points;
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => [...row]);
}

function findImmediateWinningMove(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[]
): GameMove | null {
  for (const move of orderedMoves(state, legalMoves)) {
    const result = applyGameMove({ ...state, turn: player }, player, move);
    if (result.ok && result.state.winner === player) return move;
  }

  return null;
}

function chooseBySearch(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[],
  depth: number
): GameMove {
  return orderedMoves(state, legalMoves)
    .map((move) => {
      const result = applyGameMove(state, player, move);
      return {
        move,
        score: result.ok
          ? evaluateState(result.state, player, depth - 1)
          : Number.NEGATIVE_INFINITY
      };
    })
    .sort((a, b) => b.score - a.score)[0].move;
}

function chooseByMinimax(
  state: GameState,
  player: PlayerMark,
  legalMoves: GameMove[],
  depth: number
): GameMove {
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

function minimax(
  state: GameState,
  bot: PlayerMark,
  depth: number,
  alpha: number,
  beta: number
): number {
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
    return Math.max(
      ...orderedMoves(state, legalMoves).map((move) => {
        const result = applyGameMove(state, state.turn, move);
        return result.ok ? evaluateState(result.state, bot, depth - 1) : Number.NEGATIVE_INFINITY;
      })
    );
  }

  return Math.min(
    ...orderedMoves(state, legalMoves).map((move) => {
      const result = applyGameMove(state, state.turn, move);
      return result.ok ? evaluateState(result.state, bot, depth - 1) : Number.POSITIVE_INFINITY;
    })
  );
}

function boardScore(state: GameState, bot: PlayerMark): number {
  if (state.winner === bot) return 1_000_000 + (1000 - state.moveCount);
  if (state.winner === otherPlayer(bot)) return -1_000_000 - (1000 - state.moveCount);
  if (state.winner === "draw") return 0;

  const opponent = otherPlayer(bot);
  return (
    lineScore(state, bot) -
    lineScore(state, opponent) * 1.08 +
    centerScore(state, bot) -
    centerScore(state, opponent)
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

function orderedMoves(state: GameState, moves: GameMove[]): GameMove[] {
  const centerColumn = (getGameDefinition(state.gameId).columns - 1) / 2;
  const centerRow = (getGameDefinition(state.gameId).rows - 1) / 2;

  return [...moves].sort((a, b) => {
    const aDistance = Math.abs((a.row ?? centerRow) - centerRow) + Math.abs(a.column - centerColumn);
    const bDistance = Math.abs((b.row ?? centerRow) - centerRow) + Math.abs(b.column - centerColumn);
    return aDistance - bDistance;
  });
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

function otherPlayer(player: PlayerMark): PlayerMark {
  return player === "p1" ? "p2" : "p1";
}
