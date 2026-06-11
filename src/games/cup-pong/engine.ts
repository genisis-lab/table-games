// src/games/cup-pong/engine.ts
//
// Self-contained Cup Pong engine for Table Sparks.
//
// This mirrors the structure of src/games/domino/engine.ts: the module owns all
// Cup Pong rules, bot logic, and state, and is wired into src/shared/games.ts
// through thin delegating adapters (see INTEGRATION.md).
//
// Design notes
// ------------
// * The room engine (worker/game-room.ts) stays authoritative. A throw's
//   hit/miss is resolved from (power, aim) plus fresh server-side entropy, and
//   the resolved outcome is recorded on meta.lastThrow so every connected client
//   renders the identical shot purely from the broadcast RoomSnapshot.meta. The
//   per-snapshot seed is scrambled on every throw so it cannot be used to
//   precompute an outcome. No protocol change needed.
// * A throw with NO power/aim is a guaranteed make. This keeps legacy callers,
//   bots that send a bare { column }, and the current simple board working
//   unchanged, and keeps deterministic tests easy to write.
// * 2 balls per turn. A make keeps the turn until both balls are used; clearing
//   the rack opens a redemption round instead of an instant win. A tied
//   redemption sends the game to sudden-death overtime rather than a draw.

export type CupPongPlayerMark = "p1" | "p2" | "p3" | "p4";
export type CupPongDifficulty = "casual" | "sharp" | "ruthless";
export type CupPongVariant = "mini" | "classic" | "wide" | "party";
export type CupPongWinner = CupPongPlayerMark | "draw" | null;

export interface CupPongMove {
	column: number;
	/** Throw power in [0, 1]; the sweet spot is 0.5. Omit for a guaranteed throw. */
	power?: number;
	/** Lateral aim in [-1, 1]; 0 is dead center. Omit for a guaranteed throw. */
	aim?: number;
}

export interface CupPongPoint {
	row: number;
	column: number;
}

export interface CupPongThrow {
	shooter: CupPongPlayerMark;
	target: number;
	made: boolean;
	power: number;
	aim: number;
	accuracy: number;
	seed: number;
}

export interface CupPongMeta {
	cups: Record<CupPongPlayerMark, boolean[]>;
	made: Record<CupPongPlayerMark, number>;
	streak: Record<CupPongPlayerMark, number>;
	/** Balls left in the current shooter's turn. */
	ballsRemaining: number;
	/** True when the current shooter's target rack can be usefully re-racked. */
	reRackAvailable: boolean;
	redemption: { active: boolean; player: CupPongPlayerMark | null };
	/** True once a tied redemption has pushed the game into sudden-death overtime. */
	overtime: boolean;
	lastThrow: CupPongThrow | null;
	/** Opaque per-snapshot seed; scrambled on every throw so clients can't predict shots. */
	seed: number;
}

export type CupPongIntentResult =
	| {
			ok: true;
			point: CupPongPoint;
			meta: CupPongMeta;
			nextTurn: CupPongPlayerMark;
			winner: CupPongWinner;
	  }
	| { ok: false; reason: string };

export const CUP_PONG_BALLS_PER_TURN = 2;
/** A move with column === -1 is a re-rack request rather than a throw. */
export const CUP_PONG_RERACK_MOVE = -1;
/** Sudden-death overtime resets both racks to this many cups. */
const CUP_PONG_OVERTIME_RACK = 3;
const CUP_PONG_RERACK_THRESHOLDS = new Set([6, 4, 3, 2]);

function emptyCupCounts(): Record<CupPongPlayerMark, number> {
	return { p1: 0, p2: 0, p3: 0, p4: 0 };
}

function otherCupPongPlayer(player: CupPongPlayerMark): CupPongPlayerMark {
	return player === "p1" ? "p2" : "p1";
}

function clampRange(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	return Math.min(max, Math.max(min, value));
}

function randomSeed(): number {
	return ((Math.floor(Math.random() * 0x7fffffff) + 1) >>> 0) || 0x9e3779b9;
}

function liveCupCount(cups: boolean[]): number {
	return cups.filter(Boolean).length;
}

function makeRack(size: number): boolean[] {
	return Array.from({ length: size }, () => true);
}

function packCups(cups: boolean[]): boolean[] {
	const alive = liveCupCount(cups);
	return cups.map((_, index) => index < alive);
}

export function cupRackNeedsReRack(cups: boolean[]): boolean {
	const remaining = liveCupCount(cups);
	if (!CUP_PONG_RERACK_THRESHOLDS.has(remaining)) return false;
	const packed = packCups(cups);
	return cups.some((live, index) => live !== packed[index]);
}

export function isCupPongReRackAvailable(meta: CupPongMeta, player: CupPongPlayerMark): boolean {
	const opponent = otherCupPongPlayer(player);
	return cupRackNeedsReRack(meta.cups[opponent] ?? []);
}

export function createCupPongMeta(variant: CupPongVariant): CupPongMeta {
	const cupCount = variant === "party" ? 10 : 6;
	return {
		cups: {
			p1: Array.from({ length: cupCount }, () => true),
			p2: Array.from({ length: cupCount }, () => true),
			p3: [],
			p4: [],
		},
		made: emptyCupCounts(),
		streak: emptyCupCounts(),
		ballsRemaining: CUP_PONG_BALLS_PER_TURN,
		reRackAvailable: false,
		redemption: { active: false, player: null },
		overtime: false,
		lastThrow: null,
		seed: randomSeed(),
	};
}

// Backfills fields that may be missing on snapshots created before this engine
// shipped. Mutates and returns the same object.
export function normalizeCupPongMeta(meta: CupPongMeta): CupPongMeta {
	if (typeof meta.ballsRemaining !== "number" || meta.ballsRemaining <= 0) {
		meta.ballsRemaining = CUP_PONG_BALLS_PER_TURN;
	}
	if (typeof meta.seed !== "number" || meta.seed === 0) meta.seed = randomSeed();
	if (typeof meta.reRackAvailable !== "boolean") meta.reRackAvailable = false;
	if (typeof meta.overtime !== "boolean") meta.overtime = false;
	if (!meta.redemption) meta.redemption = { active: false, player: null };
	if (meta.lastThrow === undefined) meta.lastThrow = null;
	if (!meta.streak) meta.streak = emptyCupCounts();
	if (!meta.made) meta.made = emptyCupCounts();
	return meta;
}

function resolveThrow(
	meta: CupPongMeta,
	move: CupPongMove,
): { made: boolean; power: number; aim: number; accuracy: number; seed: number } {
	// Scramble the broadcast seed on every throw so a modified client can never
	// precompute an outcome from the snapshot. The shot is resolved from fresh
	// server-side entropy and recorded on meta.lastThrow for deterministic replay.
	meta.seed = randomSeed();
	const hasInput = typeof move.power === "number" && typeof move.aim === "number";
	if (!hasInput) {
		// Guaranteed make: legacy callers and the "perfect" manual default.
		return { made: true, power: 1, aim: 0, accuracy: 1, seed: meta.seed };
	}
	const power = clampRange(move.power as number, 0, 1);
	const aim = clampRange(move.aim as number, -1, 1);
	const powerError = Math.abs(power - 0.5) * 2; // 0 at the sweet spot, 1 at the extremes
	const aimError = Math.abs(aim);
	const accuracy = clampRange(1 - (powerError * 0.45 + aimError * 0.55), 0, 1);
	const roll = Math.random();
	// roll is in [0, 1): accuracy 1 always makes, accuracy 0 always misses.
	return { made: roll < accuracy, power, aim, accuracy, seed: meta.seed };
}

export function applyCupPongIntent(
	source: CupPongMeta,
	player: CupPongPlayerMark,
	move: CupPongMove,
): CupPongIntentResult {
	const meta = normalizeCupPongMeta(JSON.parse(JSON.stringify(source)) as CupPongMeta);
	const opponent = otherCupPongPlayer(player);

	// Re-rack: a reformation request. Does not consume a ball or pass the turn.
	if (move.column === CUP_PONG_RERACK_MOVE) {
		if (!cupRackNeedsReRack(meta.cups[opponent])) {
			return { ok: false, reason: "Re-rack is only available when the opponent rack is scattered at 6, 4, 3, or 2 cups." };
		}
		meta.cups[opponent] = packCups(meta.cups[opponent]);
		meta.reRackAvailable = isCupPongReRackAvailable(meta, player);
		meta.lastThrow = null;
		return { ok: true, point: { row: 0, column: CUP_PONG_RERACK_MOVE }, meta, nextTurn: player, winner: null };
	}

	const target = move.column;
	if (!Number.isInteger(target) || target < 0 || target >= meta.cups[opponent].length) {
		return { ok: false, reason: "Choose one of the opponent cups." };
	}
	if (!meta.cups[opponent][target]) {
		return { ok: false, reason: "That cup is already gone." };
	}

	const shot = resolveThrow(meta, move);
	if (shot.made) {
		meta.cups[opponent][target] = false;
		meta.made[player] += 1;
		meta.streak[player] += 1;
	} else {
		meta.streak[player] = 0;
	}
	meta.lastThrow = {
		shooter: player,
		target,
		made: shot.made,
		power: shot.power,
		aim: shot.aim,
		accuracy: shot.accuracy,
		seed: shot.seed,
	};

	const opponentRemaining = liveCupCount(meta.cups[opponent]);
	meta.ballsRemaining -= 1;

	let winner: CupPongWinner = null;
	let nextTurn: CupPongPlayerMark = player;

	if (meta.overtime) {
		// Sudden death: the next cleared rack wins outright, no further redemption.
		if (opponentRemaining === 0) {
			winner = player;
			meta.ballsRemaining = CUP_PONG_BALLS_PER_TURN;
		} else if (meta.ballsRemaining <= 0) {
			meta.ballsRemaining = CUP_PONG_BALLS_PER_TURN;
			nextTurn = opponent;
		} else {
			nextTurn = player;
		}
	} else if (meta.redemption.active && meta.redemption.player === player) {
		// The player is taking redemption shots at the original shooter's rack.
		if (opponentRemaining === 0) {
			// Tied it up: go to sudden-death overtime instead of a forced draw.
			meta.overtime = true;
			meta.redemption = { active: false, player: null };
			meta.cups[player] = makeRack(CUP_PONG_OVERTIME_RACK);
			meta.cups[opponent] = makeRack(CUP_PONG_OVERTIME_RACK);
			meta.ballsRemaining = CUP_PONG_BALLS_PER_TURN;
			nextTurn = player; // the player who forced overtime shoots first
		} else if (meta.ballsRemaining <= 0) {
			// Redemption failed: the original shooter wins.
			winner = opponent;
			meta.redemption = { active: false, player: null };
			meta.ballsRemaining = CUP_PONG_BALLS_PER_TURN;
		} else {
			nextTurn = player;
		}
	} else if (opponentRemaining === 0) {
		// Cleared the rack: grant the opponent a redemption round, not an instant win.
		meta.redemption = { active: true, player: opponent };
		meta.ballsRemaining = Math.max(1, liveCupCount(meta.cups[player]));
		nextTurn = opponent;
	} else if (meta.ballsRemaining <= 0) {
		meta.ballsRemaining = CUP_PONG_BALLS_PER_TURN;
		nextTurn = opponent;
	} else {
		nextTurn = player;
	}

	meta.reRackAvailable = winner ? false : isCupPongReRackAvailable(meta, nextTurn);
	return { ok: true, point: { row: 0, column: target }, meta, nextTurn, winner };
}

export function getCupPongLegalMoves(meta: CupPongMeta, player: CupPongPlayerMark): CupPongMove[] {
	const opponent = otherCupPongPlayer(player);
	const throwMoves = meta.cups[opponent]
		.map((live, column) => ({ live, column }))
		.filter((cup) => cup.live)
		.map(({ column }) => ({ column }));
	return isCupPongReRackAvailable(meta, player) ? [{ column: CUP_PONG_RERACK_MOVE }, ...throwMoves] : throwMoves;
}

export function chooseCupPongBotMove(
	meta: CupPongMeta,
	player: CupPongPlayerMark,
	legalMoves: CupPongMove[],
	difficulty: CupPongDifficulty,
): CupPongMove {
	if (legalMoves.length === 0) return { column: 0 };
	const opponent = otherCupPongPlayer(player);
	const cups = meta.cups[opponent];
	const center = (cups.length - 1) / 2;

	const target =
		difficulty === "casual"
			? legalMoves[Math.floor(Math.random() * legalMoves.length)]
			: [...legalMoves].sort(
					(a, b) => Math.abs(a.column - center) - Math.abs(b.column - center),
			  )[0] ?? legalMoves[0];

	// Lower difficulty => wider wobble => more misses.
	const wobble = difficulty === "ruthless" ? 0.05 : difficulty === "sharp" ? 0.16 : 0.4;
	const aim = (Math.random() * 2 - 1) * wobble;
	const power = clampRange(0.5 + (Math.random() * 2 - 1) * wobble, 0, 1);
	return { column: target.column, power, aim };
}
