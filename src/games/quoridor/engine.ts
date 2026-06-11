// src/games/quoridor/engine.ts
//
// Self-contained Quoridor engine for Table Sparks.
//
// Mirrors src/games/cup-pong/engine.ts. Two pawns race across a 9x9 board: p1
// starts on the bottom row aiming for the top row; p2 starts on the top row
// aiming for the bottom. On a turn a player either steps their pawn one cell
// (jumping a face-to-face opponent when possible) or places one of their walls
// to lengthen the opponent's route. A wall may never completely cut either
// pawn off from its goal row.

export type QuoridorPlayerMark = "p1" | "p2" | "p3" | "p4";
export type QuoridorDifficulty = "casual" | "sharp" | "ruthless";
export type QuoridorVariant = "mini" | "classic" | "wide" | "party";
export type QuoridorWinner = QuoridorPlayerMark | "draw" | null;
export type QuoridorWallOrientation = "h" | "v";
export type QuoridorDuelMark = "p1" | "p2";

export interface QuoridorWall {
	row: number;
	column: number;
	orientation: QuoridorWallOrientation;
}

export type QuoridorMove =
	| { type: "pawn"; row: number; column: number }
	| { type: "wall"; row: number; column: number; orientation: QuoridorWallOrientation };

export type QuoridorPawnMove = Extract<QuoridorMove, { type: "pawn" }>;
export type QuoridorWallMove = Extract<QuoridorMove, { type: "wall" }>;

export interface QuoridorPoint {
	row: number;
	column: number;
}

export interface QuoridorPawn {
	row: number;
	column: number;
}

export interface QuoridorMeta {
	size: number;
	pawns: Record<QuoridorDuelMark, QuoridorPawn>;
	walls: QuoridorWall[];
	wallsRemaining: Record<QuoridorDuelMark, number>;
	lastMove: QuoridorMove | null;
	seed: number;
}

export type QuoridorIntentResult =
	| {
			ok: true;
			point: QuoridorPoint;
			meta: QuoridorMeta;
			nextTurn: QuoridorDuelMark;
			winner: QuoridorWinner;
	  }
	| { ok: false; reason: string };

const STEPS: ReadonlyArray<readonly [number, number]> = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1],
];

function randomSeed(): number {
	return ((Math.floor(Math.random() * 0x7fffffff) + 1) >>> 0) || 0x9e3779b9;
}

function duelMark(player: QuoridorPlayerMark): QuoridorDuelMark {
	return player === "p2" ? "p2" : "p1";
}

function goalRow(size: number, mark: QuoridorDuelMark): number {
	return mark === "p1" ? 0 : size - 1;
}

function hasHorizontalWall(walls: QuoridorWall[], topRow: number, c: number): boolean {
	if (topRow < 0) return false;
	return walls.some(
		(w) => w.orientation === "h" && w.row === topRow && (w.column === c || w.column === c - 1),
	);
}

function hasVerticalWall(walls: QuoridorWall[], row: number, leftCol: number): boolean {
	if (leftCol < 0) return false;
	return walls.some(
		(w) => w.orientation === "v" && w.column === leftCol && (w.row === row || w.row === row - 1),
	);
}

function isBlocked(
	walls: QuoridorWall[],
	fr: number,
	fc: number,
	tr: number,
	tc: number,
): boolean {
	if (tr === fr - 1 && tc === fc) return hasHorizontalWall(walls, fr - 1, fc);
	if (tr === fr + 1 && tc === fc) return hasHorizontalWall(walls, fr, fc);
	if (tc === fc - 1 && tr === fr) return hasVerticalWall(walls, fr, fc - 1);
	if (tc === fc + 1 && tr === fr) return hasVerticalWall(walls, fr, fc);
	return true;
}

function distanceToGoal(
	size: number,
	walls: QuoridorWall[],
	start: QuoridorPawn,
	goalR: number,
): number {
	const visited = new Set<number>();
	let frontier: QuoridorPawn[] = [start];
	visited.add(start.row * size + start.column);
	let dist = 0;
	while (frontier.length > 0) {
		const next: QuoridorPawn[] = [];
		for (const cur of frontier) {
			if (cur.row === goalR) return dist;
			for (const [dr, dc] of STEPS) {
				const nr = cur.row + dr;
				const nc = cur.column + dc;
				if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
				if (isBlocked(walls, cur.row, cur.column, nr, nc)) continue;
				const key = nr * size + nc;
				if (visited.has(key)) continue;
				visited.add(key);
				next.push({ row: nr, column: nc });
			}
		}
		frontier = next;
		dist += 1;
	}
	return Number.POSITIVE_INFINITY;
}

function hasPathToGoal(
	size: number,
	walls: QuoridorWall[],
	start: QuoridorPawn,
	goalR: number,
): boolean {
	return distanceToGoal(size, walls, start, goalR) !== Number.POSITIVE_INFINITY;
}

function wallConflicts(walls: QuoridorWall[], wall: QuoridorWall): boolean {
	return walls.some((w) => {
		if (w.row === wall.row && w.column === wall.column) return true;
		if (
			wall.orientation === "h" &&
			w.orientation === "h" &&
			w.row === wall.row &&
			Math.abs(w.column - wall.column) === 1
		) {
			return true;
		}
		if (
			wall.orientation === "v" &&
			w.orientation === "v" &&
			w.column === wall.column &&
			Math.abs(w.row - wall.row) === 1
		) {
			return true;
		}
		return false;
	});
}

function isValidWall(meta: QuoridorMeta, wall: QuoridorWall): boolean {
	const size = meta.size;
	if (wall.row < 0 || wall.row >= size - 1 || wall.column < 0 || wall.column >= size - 1) {
		return false;
	}
	if (wallConflicts(meta.walls, wall)) return false;
	const walls = [...meta.walls, wall];
	if (!hasPathToGoal(size, walls, meta.pawns.p1, goalRow(size, "p1"))) return false;
	if (!hasPathToGoal(size, walls, meta.pawns.p2, goalRow(size, "p2"))) return false;
	return true;
}

function pawnMoves(meta: QuoridorMeta, mark: QuoridorDuelMark): QuoridorPawnMove[] {
	const size = meta.size;
	const me = meta.pawns[mark];
	const opp = meta.pawns[mark === "p1" ? "p2" : "p1"];
	const moves: QuoridorPawnMove[] = [];
	for (const [dr, dc] of STEPS) {
		const nr = me.row + dr;
		const nc = me.column + dc;
		if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
		if (isBlocked(meta.walls, me.row, me.column, nr, nc)) continue;
		if (opp.row === nr && opp.column === nc) {
			const jr = nr + dr;
			const jc = nc + dc;
			if (
				jr >= 0 && jr < size && jc >= 0 && jc < size &&
				!isBlocked(meta.walls, nr, nc, jr, jc)
			) {
				moves.push({ type: "pawn", row: jr, column: jc });
			} else {
				const perps: ReadonlyArray<readonly [number, number]> =
					dr === 0 ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
				for (const [pr, pc] of perps) {
					const sr = nr + pr;
					const sc = nc + pc;
					if (
						sr >= 0 && sr < size && sc >= 0 && sc < size &&
						!isBlocked(meta.walls, nr, nc, sr, sc)
					) {
						moves.push({ type: "pawn", row: sr, column: sc });
					}
				}
			}
		} else {
			moves.push({ type: "pawn", row: nr, column: nc });
		}
	}
	return moves;
}

export function createQuoridorMeta(variant: QuoridorVariant): QuoridorMeta {
	const size = 9;
	const mid = Math.floor(size / 2);
	const walls = variant === "mini" ? 7 : variant === "party" ? 12 : 10;
	return {
		size,
		pawns: {
			p1: { row: size - 1, column: mid },
			p2: { row: 0, column: mid },
		},
		walls: [],
		wallsRemaining: { p1: walls, p2: walls },
		lastMove: null,
		seed: randomSeed(),
	};
}

export function normalizeQuoridorMeta(meta: QuoridorMeta): QuoridorMeta {
	if (typeof meta.size !== "number" || meta.size <= 0) meta.size = 9;
	if (!meta.pawns) {
		const mid = Math.floor(meta.size / 2);
		meta.pawns = { p1: { row: meta.size - 1, column: mid }, p2: { row: 0, column: mid } };
	}
	if (!Array.isArray(meta.walls)) meta.walls = [];
	if (!meta.wallsRemaining) meta.wallsRemaining = { p1: 10, p2: 10 };
	if (meta.lastMove === undefined) meta.lastMove = null;
	if (typeof meta.seed !== "number" || meta.seed === 0) meta.seed = randomSeed();
	return meta;
}

export function applyQuoridorIntent(
	source: QuoridorMeta,
	player: QuoridorPlayerMark,
	move: QuoridorMove,
): QuoridorIntentResult {
	const meta = normalizeQuoridorMeta(JSON.parse(JSON.stringify(source)) as QuoridorMeta);
	meta.seed = randomSeed();
	const mark = duelMark(player);
	const opponent: QuoridorDuelMark = mark === "p1" ? "p2" : "p1";

	if (move.type === "pawn") {
		const legal = pawnMoves(meta, mark);
		const ok = legal.some((m) => m.row === move.row && m.column === move.column);
		if (!ok) return { ok: false, reason: "That pawn move isn't allowed." };
		meta.pawns[mark] = { row: move.row, column: move.column };
		meta.lastMove = { type: "pawn", row: move.row, column: move.column };
		const winner: QuoridorWinner = move.row === goalRow(meta.size, mark) ? mark : null;
		return {
			ok: true,
			point: { row: move.row, column: move.column },
			meta,
			nextTurn: winner ? mark : opponent,
			winner,
		};
	}

	if (move.type === "wall") {
		if (meta.wallsRemaining[mark] <= 0) return { ok: false, reason: "You have no walls left." };
		const wall: QuoridorWall = { row: move.row, column: move.column, orientation: move.orientation };
		if (!isValidWall(meta, wall)) return { ok: false, reason: "A wall can't go there." };
		meta.walls.push(wall);
		meta.wallsRemaining[mark] -= 1;
		meta.lastMove = { type: "wall", row: wall.row, column: wall.column, orientation: wall.orientation };
		return { ok: true, point: { row: wall.row, column: wall.column }, meta, nextTurn: opponent, winner: null };
	}

	return { ok: false, reason: "Unknown move." };
}

export function getQuoridorLegalMoves(
	meta: QuoridorMeta,
	player: QuoridorPlayerMark,
): QuoridorMove[] {
	const mark = duelMark(player);
	const moves: QuoridorMove[] = [...pawnMoves(meta, mark)];
	if (meta.wallsRemaining[mark] > 0) {
		const orientations: QuoridorWallOrientation[] = ["h", "v"];
		for (const orientation of orientations) {
			for (let r = 0; r < meta.size - 1; r += 1) {
				for (let c = 0; c < meta.size - 1; c += 1) {
					if (isValidWall(meta, { row: r, column: c, orientation })) {
						moves.push({ type: "wall", row: r, column: c, orientation });
					}
				}
			}
		}
	}
	return moves;
}

export function chooseQuoridorBotMove(
	meta: QuoridorMeta,
	player: QuoridorPlayerMark,
	legalMoves: QuoridorMove[],
	difficulty: QuoridorDifficulty,
): QuoridorMove {
	const mark = duelMark(player);
	const opponent: QuoridorDuelMark = mark === "p1" ? "p2" : "p1";
	if (legalMoves.length === 0) {
		const me = meta.pawns[mark];
		return { type: "pawn", row: me.row, column: me.column };
	}
	if (difficulty === "casual") {
		return legalMoves[Math.floor(Math.random() * legalMoves.length)];
	}

	const pawnOptions = legalMoves.filter((m): m is QuoridorPawnMove => m.type === "pawn");
	const wallOptions = legalMoves.filter((m): m is QuoridorWallMove => m.type === "wall");

	let bestPawn: QuoridorPawnMove | null = null;
	let bestPawnDist = Number.POSITIVE_INFINITY;
	for (const m of pawnOptions) {
		const d = distanceToGoal(meta.size, meta.walls, { row: m.row, column: m.column }, goalRow(meta.size, mark));
		if (d < bestPawnDist) {
			bestPawnDist = d;
			bestPawn = m;
		}
	}

	if (difficulty === "ruthless" && wallOptions.length > 0) {
		const myDist = distanceToGoal(meta.size, meta.walls, meta.pawns[mark], goalRow(meta.size, mark));
		const oppDist = distanceToGoal(meta.size, meta.walls, meta.pawns[opponent], goalRow(meta.size, opponent));
		if (oppDist <= myDist) {
			let bestWall: QuoridorWallMove | null = null;
			let bestGain = 0;
			for (const w of wallOptions) {
				const walls = [...meta.walls, { row: w.row, column: w.column, orientation: w.orientation }];
				const newOpp = distanceToGoal(meta.size, walls, meta.pawns[opponent], goalRow(meta.size, opponent));
				const newMine = distanceToGoal(meta.size, walls, meta.pawns[mark], goalRow(meta.size, mark));
				const gain = newOpp - oppDist - (newMine - myDist);
				if (gain > bestGain) {
					bestGain = gain;
					bestWall = w;
				}
			}
			if (bestWall && bestGain >= 2) return bestWall;
		}
	}

	if (bestPawn) return bestPawn;
	return legalMoves[Math.floor(Math.random() * legalMoves.length)];
}
