// src/games/dice-duel/engine.ts
//
// Self-contained Dice Duel engine for Table Games.
//
// Mirrors src/games/cup-pong/engine.ts: this module owns all Dice Duel rules,
// bot logic, and state, and is wired into src/shared/games.ts through thin
// delegating adapters.
//
// Rules: a press-your-luck dice race between p1 and p2. On your turn you ROLL
// to add the die (or dice) to a running pot; rolling a single 1 busts the pot
// and ends your turn. BANK to store the pot into your score and pass the turn.
// First player to reach the target score wins. The "party" variant rolls two
// dice: any single 1 busts the pot, and a double 1 also wipes your banked score.

export type DiceDuelPlayerMark = "p1" | "p2" | "p3" | "p4";
export type DiceDuelDifficulty = "casual" | "sharp" | "ruthless";
export type DiceDuelVariant = "mini" | "classic" | "wide" | "party";
export type DiceDuelWinner = DiceDuelPlayerMark | "draw" | null;

export interface DiceDuelMove {
	/** "roll" presses your luck; "bank" banks the pot and passes the turn. */
	action: "roll" | "bank";
}

export interface DiceDuelPoint {
	row: number;
	column: number;
}

export interface DiceDuelRoll {
	roller: DiceDuelPlayerMark;
	dice: number[];
	bust: boolean;
	wiped: boolean;
	gained: number;
	seed: number;
}

export interface DiceDuelMeta {
	scores: Record<DiceDuelPlayerMark, number>;
	pot: number;
	target: number;
	diceCount: number;
	lastRoll: DiceDuelRoll | null;
	seed: number;
}

export type DiceDuelIntentResult =
	| {
			ok: true;
			point: DiceDuelPoint;
			meta: DiceDuelMeta;
			nextTurn: DiceDuelPlayerMark;
			winner: DiceDuelWinner;
	  }
	| { ok: false; reason: string };

function randomSeed(): number {
	return ((Math.floor(Math.random() * 0x7fffffff) + 1) >>> 0) || 0x9e3779b9;
}

function otherDiceDuelPlayer(player: DiceDuelPlayerMark): DiceDuelPlayerMark {
	return player === "p1" ? "p2" : "p1";
}

function targetForVariant(variant: DiceDuelVariant): number {
	switch (variant) {
		case "mini":
			return 50;
		case "wide":
			return 120;
		case "party":
			return 150;
		case "classic":
		default:
			return 100;
	}
}

function rollDie(): number {
	return Math.floor(Math.random() * 6) + 1;
}

export function createDiceDuelMeta(variant: DiceDuelVariant): DiceDuelMeta {
	return {
		scores: { p1: 0, p2: 0, p3: 0, p4: 0 },
		pot: 0,
		target: targetForVariant(variant),
		diceCount: variant === "party" ? 2 : 1,
		lastRoll: null,
		seed: randomSeed(),
	};
}

export function normalizeDiceDuelMeta(meta: DiceDuelMeta): DiceDuelMeta {
	if (!meta.scores) meta.scores = { p1: 0, p2: 0, p3: 0, p4: 0 };
	if (typeof meta.pot !== "number") meta.pot = 0;
	if (typeof meta.target !== "number" || meta.target <= 0) meta.target = 100;
	if (typeof meta.diceCount !== "number" || meta.diceCount < 1) meta.diceCount = 1;
	if (meta.lastRoll === undefined) meta.lastRoll = null;
	if (typeof meta.seed !== "number" || meta.seed === 0) meta.seed = randomSeed();
	return meta;
}

export function applyDiceDuelIntent(
	source: DiceDuelMeta,
	player: DiceDuelPlayerMark,
	move: DiceDuelMove,
): DiceDuelIntentResult {
	const meta = normalizeDiceDuelMeta(JSON.parse(JSON.stringify(source)) as DiceDuelMeta);
	meta.seed = randomSeed();
	const opponent = otherDiceDuelPlayer(player);

	if (move.action === "bank") {
		if (meta.pot <= 0) {
			return { ok: false, reason: "Nothing to bank yet \u2014 roll first." };
		}
		meta.scores[player] += meta.pot;
		meta.lastRoll = null;
		meta.pot = 0;
		const winner: DiceDuelWinner = meta.scores[player] >= meta.target ? player : null;
		return {
			ok: true,
			point: { row: 0, column: 0 },
			meta,
			nextTurn: winner ? player : opponent,
			winner,
		};
	}

	if (move.action !== "roll") {
		return { ok: false, reason: "Unknown move." };
	}

	const dice: number[] = [];
	for (let i = 0; i < meta.diceCount; i += 1) dice.push(rollDie());
	const ones = dice.filter((d) => d === 1).length;
	const bust = ones > 0;
	const wiped = meta.diceCount >= 2 && ones >= 2;

	let nextTurn: DiceDuelPlayerMark = player;
	let gained = 0;
	if (wiped) {
		meta.scores[player] = 0;
		meta.pot = 0;
		nextTurn = opponent;
	} else if (bust) {
		meta.pot = 0;
		nextTurn = opponent;
	} else {
		gained = dice.reduce((sum, d) => sum + d, 0);
		meta.pot += gained;
		nextTurn = player;
	}

	meta.lastRoll = { roller: player, dice, bust, wiped, gained, seed: meta.seed };
	return { ok: true, point: { row: 0, column: 0 }, meta, nextTurn, winner: null };
}

export function getDiceDuelLegalMoves(
	meta: DiceDuelMeta,
	_player: DiceDuelPlayerMark,
): DiceDuelMove[] {
	return meta.pot > 0 ? [{ action: "roll" }, { action: "bank" }] : [{ action: "roll" }];
}

export function chooseDiceDuelBotMove(
	meta: DiceDuelMeta,
	player: DiceDuelPlayerMark,
	legalMoves: DiceDuelMove[],
	difficulty: DiceDuelDifficulty,
): DiceDuelMove {
	const canBank = legalMoves.some((m) => m.action === "bank");
	if (canBank && meta.scores[player] + meta.pot >= meta.target) {
		return { action: "bank" };
	}
	const bankThreshold = difficulty === "ruthless" ? 24 : difficulty === "sharp" ? 20 : 14;
	if (difficulty === "casual" && canBank && Math.random() < 0.18) {
		return { action: "bank" };
	}
	if (canBank && meta.pot >= bankThreshold) {
		return { action: "bank" };
	}
	return { action: "roll" };
}
