// src/games/memory-match/engine.ts
//
// Self-contained Memory Match (concentration) engine for Table Games.
//
// Mirrors src/games/cup-pong/engine.ts. Players alternate flipping two cards;
// a matched pair scores a point and grants another turn, a mismatch passes the
// turn. When every pair is matched the higher score wins (ties draw).
//
// NOTE: card values live on the meta. Face-down card values should be masked
// from clients by maskGameMetaForPlayer in src/shared/games.ts so opponents
// (and modified clients) cannot read unflipped cards.

export type MemoryMatchPlayerMark = "p1" | "p2" | "p3" | "p4";
export type MemoryMatchDifficulty = "casual" | "sharp" | "ruthless";
export type MemoryMatchVariant = "mini" | "classic" | "wide" | "party";
export type MemoryMatchWinner = MemoryMatchPlayerMark | "draw" | null;

export interface MemoryMatchMove {
	index: number;
}

export interface MemoryMatchPoint {
	row: number;
	column: number;
}

export interface MemoryMatchCard {
	value: number;
	matched: boolean;
}

export interface MemoryMatchMeta {
	columns: number;
	cards: MemoryMatchCard[];
	faceUp: number[];
	scores: Record<MemoryMatchPlayerMark, number>;
	pairsRemaining: number;
	lastPair: { a: number; b: number; matched: boolean } | null;
	seed: number;
}

export type MemoryMatchIntentResult =
	| {
			ok: true;
			point: MemoryMatchPoint;
			meta: MemoryMatchMeta;
			nextTurn: MemoryMatchPlayerMark;
			winner: MemoryMatchWinner;
	  }
	| { ok: false; reason: string };

function randomSeed(): number {
	return ((Math.floor(Math.random() * 0x7fffffff) + 1) >>> 0) || 0x9e3779b9;
}

function otherMemoryPlayer(player: MemoryMatchPlayerMark): MemoryMatchPlayerMark {
	return player === "p1" ? "p2" : "p1";
}

function pointFor(columns: number, index: number): MemoryMatchPoint {
	const cols = columns > 0 ? columns : 4;
	return { row: Math.floor(index / cols), column: index % cols };
}

function shuffle<T>(input: T[]): T[] {
	const arr = input.slice();
	for (let i = arr.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}
	return arr;
}

function pairsForVariant(variant: MemoryMatchVariant): number {
	switch (variant) {
		case "mini":
			return 6;
		case "wide":
			return 10;
		case "party":
			return 12;
		case "classic":
		default:
			return 8;
	}
}

function decideMemoryWinner(scores: Record<MemoryMatchPlayerMark, number>): MemoryMatchWinner {
	if (scores.p1 > scores.p2) return "p1";
	if (scores.p2 > scores.p1) return "p2";
	return "draw";
}

export function createMemoryMatchMeta(variant: MemoryMatchVariant): MemoryMatchMeta {
	const pairs = pairsForVariant(variant);
	const columns = pairs <= 8 ? 4 : pairs <= 10 ? 5 : 6;
	const values: number[] = [];
	for (let v = 0; v < pairs; v += 1) values.push(v, v);
	const shuffled = shuffle(values);
	return {
		columns,
		cards: shuffled.map((value) => ({ value, matched: false })),
		faceUp: [],
		scores: { p1: 0, p2: 0, p3: 0, p4: 0 },
		pairsRemaining: pairs,
		lastPair: null,
		seed: randomSeed(),
	};
}

export function normalizeMemoryMatchMeta(meta: MemoryMatchMeta): MemoryMatchMeta {
	if (typeof meta.columns !== "number" || meta.columns <= 0) meta.columns = 4;
	if (!Array.isArray(meta.cards)) meta.cards = [];
	if (!Array.isArray(meta.faceUp)) meta.faceUp = [];
	if (!meta.scores) meta.scores = { p1: 0, p2: 0, p3: 0, p4: 0 };
	if (typeof meta.pairsRemaining !== "number") {
		meta.pairsRemaining = Math.floor(meta.cards.filter((c) => !c.matched).length / 2);
	}
	if (meta.lastPair === undefined) meta.lastPair = null;
	if (typeof meta.seed !== "number" || meta.seed === 0) meta.seed = randomSeed();
	return meta;
}

export function applyMemoryMatchIntent(
	source: MemoryMatchMeta,
	player: MemoryMatchPlayerMark,
	move: MemoryMatchMove,
): MemoryMatchIntentResult {
	const meta = normalizeMemoryMatchMeta(JSON.parse(JSON.stringify(source)) as MemoryMatchMeta);
	meta.seed = randomSeed();
	const opponent = otherMemoryPlayer(player);
	const index = move.index;
	if (!Number.isInteger(index) || index < 0 || index >= meta.cards.length) {
		return { ok: false, reason: "Choose a card." };
	}
	if (meta.cards[index].matched) {
		return { ok: false, reason: "That pair is already matched." };
	}
	if (meta.faceUp.includes(index)) {
		return { ok: false, reason: "That card is already face up." };
	}
	if (meta.faceUp.length >= 2) meta.faceUp = [];
	const point = pointFor(meta.columns, index);

	if (meta.faceUp.length === 0) {
		meta.faceUp = [index];
		meta.lastPair = null;
		return { ok: true, point, meta, nextTurn: player, winner: null };
	}

	const a = meta.faceUp[0];
	const b = index;
	if (meta.cards[a].value === meta.cards[b].value) {
		meta.cards[a].matched = true;
		meta.cards[b].matched = true;
		meta.scores[player] += 1;
		meta.pairsRemaining -= 1;
		meta.faceUp = [];
		meta.lastPair = { a, b, matched: true };
		const winner: MemoryMatchWinner = meta.pairsRemaining <= 0 ? decideMemoryWinner(meta.scores) : null;
		return { ok: true, point, meta, nextTurn: player, winner };
	}

	meta.faceUp = [];
	meta.lastPair = { a, b, matched: false };
	return { ok: true, point, meta, nextTurn: opponent, winner: null };
}

export function getMemoryMatchLegalMoves(
	meta: MemoryMatchMeta,
	_player: MemoryMatchPlayerMark,
): MemoryMatchMove[] {
	const moves: MemoryMatchMove[] = [];
	for (let i = 0; i < meta.cards.length; i += 1) {
		if (!meta.cards[i].matched && !meta.faceUp.includes(i)) moves.push({ index: i });
	}
	return moves;
}

export function chooseMemoryMatchBotMove(
	meta: MemoryMatchMeta,
	_player: MemoryMatchPlayerMark,
	legalMoves: MemoryMatchMove[],
	difficulty: MemoryMatchDifficulty,
): MemoryMatchMove {
	if (legalMoves.length === 0) return { index: 0 };
	const pickRandom = (): MemoryMatchMove => legalMoves[Math.floor(Math.random() * legalMoves.length)];

	if (meta.faceUp.length === 1) {
		const faceValue = meta.cards[meta.faceUp[0]].value;
		const match = legalMoves.find((m) => meta.cards[m.index].value === faceValue);
		if (match) {
			if (difficulty === "ruthless") return match;
			if (difficulty === "sharp" && Math.random() < 0.6) return match;
		}
		return pickRandom();
	}

	if (difficulty !== "casual") {
		const byValue = new Map<number, number[]>();
		for (const m of legalMoves) {
			const v = meta.cards[m.index].value;
			const list = byValue.get(v) ?? [];
			list.push(m.index);
			byValue.set(v, list);
		}
		let completable: number[] | null = null;
		for (const list of byValue.values()) {
			if (list.length >= 2) {
				completable = list;
				break;
			}
		}
		if (completable) {
			const setupChance = difficulty === "ruthless" ? 1 : 0.4;
			if (Math.random() < setupChance) return { index: completable[0] };
		}
	}
	return pickRandom();
}
