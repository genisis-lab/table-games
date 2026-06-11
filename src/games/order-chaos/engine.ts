// src/games/order-chaos/engine.ts
//
// Self-contained Order and Chaos engine for Table Sparks.
//
// Mirrors src/games/cup-pong/engine.ts. p1 plays "Order" and wins by forming a
// line of five identical marks (horizontal, vertical, or diagonal) anywhere on
// the 6x6 board. p2 plays "Chaos" and wins if the board fills with no such
// line. On every turn the player to move places EITHER an X or an O on any
// empty cell; a completed line of five always wins for Order, no matter who
// placed the final mark.

export type OrderChaosPlayerMark = "p1" | "p2" | "p3" | "p4";
export type OrderChaosDifficulty = "casual" | "sharp" | "ruthless";
export type OrderChaosVariant = "mini" | "classic" | "wide" | "party";
export type OrderChaosWinner = OrderChaosPlayerMark | "draw" | null;
export type OrderChaosPiece = "X" | "O";
export type OrderChaosCell = OrderChaosPiece | "";

export interface OrderChaosMove {
	index: number;
	piece: OrderChaosPiece;
}

export interface OrderChaosPoint {
	row: number;
	column: number;
}

export interface OrderChaosMeta {
	size: number;
	lineLength: number;
	board: OrderChaosCell[];
	lastMove: { index: number; piece: OrderChaosPiece; player: OrderChaosPlayerMark } | null;
	seed: number;
}

export type OrderChaosIntentResult =
	| {
			ok: true;
			point: OrderChaosPoint;
			meta: OrderChaosMeta;
			nextTurn: OrderChaosPlayerMark;
			winner: OrderChaosWinner;
	  }
	| { ok: false; reason: string };

const DIRS: ReadonlyArray<readonly [number, number]> = [
	[0, 1],
	[1, 0],
	[1, 1],
	[1, -1],
];

function randomSeed(): number {
	return ((Math.floor(Math.random() * 0x7fffffff) + 1) >>> 0) || 0x9e3779b9;
}

function pointFor(size: number, index: number): OrderChaosPoint {
	return { row: Math.floor(index / size), column: index % size };
}

function runThrough(
	board: OrderChaosCell[],
	size: number,
	index: number,
	piece: OrderChaosPiece,
	dr: number,
	dc: number,
): number {
	const r0 = Math.floor(index / size);
	const c0 = index % size;
	let count = 1;
	let r = r0 + dr;
	let c = c0 + dc;
	while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === piece) {
		count += 1;
		r += dr;
		c += dc;
	}
	r = r0 - dr;
	c = c0 - dc;
	while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === piece) {
		count += 1;
		r -= dr;
		c -= dc;
	}
	return count;
}

function makesLine(
	board: OrderChaosCell[],
	size: number,
	lineLength: number,
	index: number,
	piece: OrderChaosPiece,
): boolean {
	return DIRS.some(([dr, dc]) => runThrough(board, size, index, piece, dr, dc) >= lineLength);
}

function maxRunFor(
	board: OrderChaosCell[],
	size: number,
	index: number,
	piece: OrderChaosPiece,
): number {
	let best = 0;
	for (const [dr, dc] of DIRS) {
		best = Math.max(best, runThrough(board, size, index, piece, dr, dc));
	}
	return best;
}

export function createOrderChaosMeta(_variant: OrderChaosVariant): OrderChaosMeta {
	const size = 6;
	return {
		size,
		lineLength: 5,
		board: Array.from({ length: size * size }, () => "" as OrderChaosCell),
		lastMove: null,
		seed: randomSeed(),
	};
}

export function normalizeOrderChaosMeta(meta: OrderChaosMeta): OrderChaosMeta {
	if (typeof meta.size !== "number" || meta.size <= 0) meta.size = 6;
	if (typeof meta.lineLength !== "number" || meta.lineLength <= 0) meta.lineLength = 5;
	if (!Array.isArray(meta.board) || meta.board.length !== meta.size * meta.size) {
		meta.board = Array.from({ length: meta.size * meta.size }, () => "" as OrderChaosCell);
	}
	if (meta.lastMove === undefined) meta.lastMove = null;
	if (typeof meta.seed !== "number" || meta.seed === 0) meta.seed = randomSeed();
	return meta;
}

export function applyOrderChaosIntent(
	source: OrderChaosMeta,
	player: OrderChaosPlayerMark,
	move: OrderChaosMove,
): OrderChaosIntentResult {
	const meta = normalizeOrderChaosMeta(JSON.parse(JSON.stringify(source)) as OrderChaosMeta);
	meta.seed = randomSeed();
	const size = meta.size;
	const total = size * size;
	if (!Number.isInteger(move.index) || move.index < 0 || move.index >= total) {
		return { ok: false, reason: "Choose a cell on the board." };
	}
	if (move.piece !== "X" && move.piece !== "O") {
		return { ok: false, reason: "Choose an X or an O." };
	}
	if (meta.board[move.index] !== "") {
		return { ok: false, reason: "That cell is already taken." };
	}

	meta.board[move.index] = move.piece;
	meta.lastMove = { index: move.index, piece: move.piece, player };
	const point = pointFor(size, move.index);

	if (makesLine(meta.board, size, meta.lineLength, move.index, move.piece)) {
		return { ok: true, point, meta, nextTurn: "p1", winner: "p1" };
	}
	if (meta.board.every((cell) => cell !== "")) {
		return { ok: true, point, meta, nextTurn: "p2", winner: "p2" };
	}
	return { ok: true, point, meta, nextTurn: player === "p1" ? "p2" : "p1", winner: null };
}

export function getOrderChaosLegalMoves(
	meta: OrderChaosMeta,
	_player: OrderChaosPlayerMark,
): OrderChaosMove[] {
	const moves: OrderChaosMove[] = [];
	for (let i = 0; i < meta.board.length; i += 1) {
		if (meta.board[i] === "") {
			moves.push({ index: i, piece: "X" });
			moves.push({ index: i, piece: "O" });
		}
	}
	return moves;
}

export function chooseOrderChaosBotMove(
	meta: OrderChaosMeta,
	player: OrderChaosPlayerMark,
	legalMoves: OrderChaosMove[],
	difficulty: OrderChaosDifficulty,
): OrderChaosMove {
	if (legalMoves.length === 0) return { index: 0, piece: "X" };
	const { board, size, lineLength } = meta;
	const isOrder = player === "p1";

	if (!isOrder) {
		const safe = legalMoves.filter(
			(m) => !makesLine(board, size, lineLength, m.index, m.piece),
		);
		const pool = safe.length > 0 ? safe : legalMoves;
		if (difficulty === "casual") return pool[Math.floor(Math.random() * pool.length)];
		let best = pool[0];
		let bestRun = Number.POSITIVE_INFINITY;
		for (const m of pool) {
			const run = maxRunFor(board, size, m.index, m.piece);
			if (run < bestRun) {
				bestRun = run;
				best = m;
			}
		}
		return best;
	}

	const winning = legalMoves.find((m) => makesLine(board, size, lineLength, m.index, m.piece));
	if (winning && (difficulty !== "casual" || Math.random() < 0.6)) return winning;
	if (difficulty === "casual") return legalMoves[Math.floor(Math.random() * legalMoves.length)];
	let best = legalMoves[0];
	let bestRun = -1;
	for (const m of legalMoves) {
		const run = maxRunFor(board, size, m.index, m.piece);
		if (run > bestRun) {
			bestRun = run;
			best = m;
		}
	}
	return best;
}
