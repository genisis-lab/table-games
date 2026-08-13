/**
 * Set Trio rules engine.
 *
 * The room/worker owns this entire state. Creation is seedable and every later
 * transition is derived only from the snapshot and the submitted claim, so a
 * broadcast snapshot can be replayed without consulting Math.random or a
 * client clock.
 *
 * A card is a point in F(3)^4. Three cards form a set exactly when each of the
 * four coordinates sums to zero modulo three (the familiar "all the same or
 * all different" rule).
 */

export type SetTrioAttribute = 0 | 1 | 2;
export type SetTrioPlayerMark = "p1" | "p2";
export type SetTrioDifficulty = "casual" | "sharp" | "ruthless";
export type SetTrioVariant = "mini" | "classic" | "wide" | "party";
export type SetTrioWinner = SetTrioPlayerMark | "draw" | null;
export type SetTrioEndReason = "deck-empty-no-set" | null;

export interface SetTrioCard {
	id: string;
	/** 0, 1, 2 render as one, two, or three symbols. */
	number: SetTrioAttribute;
	color: SetTrioAttribute;
	shape: SetTrioAttribute;
	fill: SetTrioAttribute;
}

/**
 * A client may send indices, stable card IDs, or both. Supplying both is best
 * for online play: IDs are checked against the indexed cards atomically.
 */
export interface SetTrioMove {
	indices?: readonly number[];
	cardIds?: readonly string[];
}

export interface SetTrioLegalMove {
	indices: [number, number, number];
	cardIds: [string, string, string];
}

export interface SetTrioPoint {
	row: number;
	column: number;
}

export interface SetTrioConfig {
	validClaimPoints: number;
	invalidClaimPenalty: number;
	invalidClaimCooldownMs: number;
}

export interface SetTrioCooldownSignal {
	durationMs: number;
	issuedAtRevision: number;
	/** Server wall-clock deadline. Assigned by the authoritative room worker. */
	expiresAt?: number;
	reason: "invalid-set";
}

export interface SetTrioClaimRecord {
	player: SetTrioPlayerMark;
	indices: [number, number, number];
	cardIds: [string, string, string];
	valid: boolean;
	scoreDelta: number;
	reason: "set" | "invalid-set";
	revision: number;
	cooldownMs: number;
}

export interface SetTrioMeta {
	variant: SetTrioVariant;
	board: SetTrioCard[];
	/** Remaining cards in authoritative draw order; the front is drawn next. */
	deck: SetTrioCard[];
	deckRemaining: number;
	setsAvailable: number;
	scores: Record<SetTrioPlayerMark, number>;
	invalidClaims: Record<SetTrioPlayerMark, number>;
	cooldowns: Record<SetTrioPlayerMark, SetTrioCooldownSignal | null>;
	config: SetTrioConfig;
	lastClaim: SetTrioClaimRecord | null;
	/** Number of well-formed claims applied, valid or invalid. */
	claimCount: number;
	/** Monotonic snapshot revision. Stale/malformed claims do not advance it. */
	revision: number;
	/** Original shuffle seed. */
	seed: number;
	/** PRNG state immediately after the initial shuffle, useful for audits. */
	rngState: number;
	status: "playing" | "finished";
	winner: SetTrioWinner;
	endReason: SetTrioEndReason;
}

export interface SetTrioCreateOptions extends Partial<SetTrioConfig> {
	seed?: number;
}

export type SetTrioIntentResult =
	| {
			ok: true;
			point: SetTrioPoint;
			meta: SetTrioMeta;
			nextTurn: SetTrioPlayerMark;
			winner: SetTrioWinner;
	  }
	| { ok: false; reason: string };

export const SET_TRIO_DECK_SIZE = 81;
export const SET_TRIO_BASE_BOARD_SIZE = 12;
export const SET_TRIO_EXPANSION_SIZE = 3;

export const DEFAULT_SET_TRIO_CONFIG: Readonly<SetTrioConfig> = Object.freeze({
	validClaimPoints: 1,
	invalidClaimPenalty: 1,
	invalidClaimCooldownMs: 1_500,
});

const DEFAULT_NORMALIZATION_SEED = 0x6d2b79f5;

function isAttribute(value: unknown): value is SetTrioAttribute {
	return value === 0 || value === 1 || value === 2;
}

function normalizeSeed(value: unknown, fallback = DEFAULT_NORMALIZATION_SEED): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback >>> 0;
	const seed = Math.trunc(value) >>> 0;
	return seed === 0 ? fallback >>> 0 : seed;
}

function freshServerSeed(): number {
	const cryptoObject = typeof crypto === "undefined" ? undefined : crypto;
	if (cryptoObject && typeof cryptoObject.getRandomValues === "function") {
		const values = new Uint32Array(1);
		cryptoObject.getRandomValues(values);
		return normalizeSeed(values[0]);
	}
	return normalizeSeed(Math.floor(Math.random() * 0x1_0000_0000));
}

/** Small, portable uint32 PRNG. Its output is stable across JS runtimes. */
function nextRandom(state: number): { state: number; value: number } {
	let next = (state + 0x6d2b79f5) >>> 0;
	let mixed = next;
	mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
	mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
	return { state: next, value: ((mixed ^ (mixed >>> 14)) >>> 0) / 0x1_0000_0000 };
}

export function setTrioCardId(
	number: SetTrioAttribute,
	color: SetTrioAttribute,
	shape: SetTrioAttribute,
	fill: SetTrioAttribute,
): string {
	return `set-${number}${color}${shape}${fill}`;
}

export function createSetTrioCard(
	number: SetTrioAttribute,
	color: SetTrioAttribute,
	shape: SetTrioAttribute,
	fill: SetTrioAttribute,
): SetTrioCard {
	return {
		id: setTrioCardId(number, color, shape, fill),
		number,
		color,
		shape,
		fill,
	};
}

export function createSetTrioDeck(): SetTrioCard[] {
	const deck: SetTrioCard[] = [];
	for (let number = 0; number < 3; number += 1) {
		for (let color = 0; color < 3; color += 1) {
			for (let shape = 0; shape < 3; shape += 1) {
				for (let fill = 0; fill < 3; fill += 1) {
					deck.push(
						createSetTrioCard(
							number as SetTrioAttribute,
							color as SetTrioAttribute,
							shape as SetTrioAttribute,
							fill as SetTrioAttribute,
						),
					);
				}
			}
		}
	}
	return deck;
}

function shuffledSetTrioDeck(seed: number): { cards: SetTrioCard[]; rngState: number } {
	const cards = createSetTrioDeck();
	let rngState = normalizeSeed(seed);
	for (let index = cards.length - 1; index > 0; index -= 1) {
		const next = nextRandom(rngState);
		rngState = next.state;
		const swapIndex = Math.floor(next.value * (index + 1));
		[cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
	}
	return { cards, rngState };
}

function attributes(card: SetTrioCard): readonly SetTrioAttribute[] {
	return [card.number, card.color, card.shape, card.fill];
}

export function isSetTrioSet(a: SetTrioCard, b: SetTrioCard, c: SetTrioCard): boolean {
	const aa = attributes(a);
	const bb = attributes(b);
	const cc = attributes(c);
	for (let index = 0; index < aa.length; index += 1) {
		if ((aa[index] + bb[index] + cc[index]) % 3 !== 0) return false;
	}
	return true;
}

export function findSetTrioSets(cards: readonly SetTrioCard[]): SetTrioLegalMove[] {
	const sets: SetTrioLegalMove[] = [];
	for (let first = 0; first < cards.length - 2; first += 1) {
		for (let second = first + 1; second < cards.length - 1; second += 1) {
			for (let third = second + 1; third < cards.length; third += 1) {
				if (!isSetTrioSet(cards[first], cards[second], cards[third])) continue;
				sets.push({
					indices: [first, second, third],
					cardIds: [cards[first].id, cards[second].id, cards[third].id],
				});
			}
		}
	}
	return sets;
}

export function hasSetTrioSet(cards: readonly SetTrioCard[]): boolean {
	for (let first = 0; first < cards.length - 2; first += 1) {
		for (let second = first + 1; second < cards.length - 1; second += 1) {
			for (let third = second + 1; third < cards.length; third += 1) {
				if (isSetTrioSet(cards[first], cards[second], cards[third])) return true;
			}
		}
	}
	return false;
}

function toNonNegativeInteger(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.max(0, Math.trunc(value));
}

function toScore(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function normalizeConfig(value: unknown): SetTrioConfig {
	const source = value && typeof value === "object" ? (value as Partial<SetTrioConfig>) : {};
	return {
		validClaimPoints: Math.max(
			1,
			toNonNegativeInteger(source.validClaimPoints, DEFAULT_SET_TRIO_CONFIG.validClaimPoints),
		),
		invalidClaimPenalty: toNonNegativeInteger(
			source.invalidClaimPenalty,
			DEFAULT_SET_TRIO_CONFIG.invalidClaimPenalty,
		),
		invalidClaimCooldownMs: toNonNegativeInteger(
			source.invalidClaimCooldownMs,
			DEFAULT_SET_TRIO_CONFIG.invalidClaimCooldownMs,
		),
	};
}

function cardFromUnknown(value: unknown): SetTrioCard | null {
	if (!value || typeof value !== "object") return null;
	const source = value as Partial<SetTrioCard>;
	if (
		isAttribute(source.number) &&
		isAttribute(source.color) &&
		isAttribute(source.shape) &&
		isAttribute(source.fill)
	) {
		return createSetTrioCard(source.number, source.color, source.shape, source.fill);
	}
	if (typeof source.id !== "string") return null;
	const match = /^set-([0-2])([0-2])([0-2])([0-2])$/.exec(source.id);
	if (!match) return null;
	return createSetTrioCard(
		Number(match[1]) as SetTrioAttribute,
		Number(match[2]) as SetTrioAttribute,
		Number(match[3]) as SetTrioAttribute,
		Number(match[4]) as SetTrioAttribute,
	);
}

function normalizeCards(value: unknown, seen: Set<string>): SetTrioCard[] {
	if (!Array.isArray(value)) return [];
	const cards: SetTrioCard[] = [];
	for (const candidate of value) {
		const card = cardFromUnknown(candidate);
		if (!card || seen.has(card.id)) continue;
		seen.add(card.id);
		cards.push(card);
	}
	return cards;
}

function normalizePlayerRecord(
	value: unknown,
	reader: (entry: unknown) => number,
): Record<SetTrioPlayerMark, number> {
	const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	return { p1: reader(source.p1), p2: reader(source.p2) };
}

function normalizeCooldown(value: unknown): SetTrioCooldownSignal | null {
	if (!value || typeof value !== "object") return null;
	const source = value as Partial<SetTrioCooldownSignal>;
	if (source.reason !== "invalid-set") return null;
	return {
		durationMs: toNonNegativeInteger(source.durationMs, 0),
		issuedAtRevision: toNonNegativeInteger(source.issuedAtRevision, 0),
		...(typeof source.expiresAt === "number" && Number.isFinite(source.expiresAt)
			? { expiresAt: Math.max(0, Math.trunc(source.expiresAt)) }
			: {}),
		reason: "invalid-set",
	};
}

function normalizeCooldowns(value: unknown): Record<SetTrioPlayerMark, SetTrioCooldownSignal | null> {
	const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	return { p1: normalizeCooldown(source.p1), p2: normalizeCooldown(source.p2) };
}

function decideSetTrioWinner(scores: Record<SetTrioPlayerMark, number>): SetTrioWinner {
	if (scores.p1 > scores.p2) return "p1";
	if (scores.p2 > scores.p1) return "p2";
	return "draw";
}

function refreshSetTrioDerivedState(meta: SetTrioMeta): void {
	meta.deckRemaining = meta.deck.length;
	meta.setsAvailable = findSetTrioSets(meta.board).length;
	if (meta.deck.length === 0 && meta.setsAvailable === 0) {
		meta.status = "finished";
		meta.winner = decideSetTrioWinner(meta.scores);
		meta.endReason = "deck-empty-no-set";
		return;
	}
	meta.status = "playing";
	meta.winner = null;
	meta.endReason = null;
}

function dealFromFront(meta: SetTrioMeta, count: number): void {
	const drawCount = Math.min(Math.max(0, count), meta.deck.length);
	if (drawCount > 0) meta.board.push(...meta.deck.splice(0, drawCount));
}

/**
 * Expands a set-free board three cards at a time until a set appears or the
 * deck is exhausted. Mutates and returns the supplied authoritative state.
 */
export function ensureSetTrioPlayable(meta: SetTrioMeta): SetTrioMeta {
	while (!hasSetTrioSet(meta.board) && meta.deck.length > 0) {
		dealFromFront(meta, SET_TRIO_EXPANSION_SIZE);
	}
	refreshSetTrioDerivedState(meta);
	return meta;
}

export function createSetTrioMeta(
	variant: SetTrioVariant = "classic",
	optionsOrSeed: SetTrioCreateOptions | number = {},
): SetTrioMeta {
	const options = typeof optionsOrSeed === "number" ? { seed: optionsOrSeed } : optionsOrSeed;
	const seed = normalizeSeed(options.seed, freshServerSeed());
	const shuffled = shuffledSetTrioDeck(seed);
	const config = normalizeConfig(options);
	const meta: SetTrioMeta = {
		variant,
		board: shuffled.cards.splice(0, SET_TRIO_BASE_BOARD_SIZE),
		deck: shuffled.cards,
		deckRemaining: SET_TRIO_DECK_SIZE - SET_TRIO_BASE_BOARD_SIZE,
		setsAvailable: 0,
		scores: { p1: 0, p2: 0 },
		invalidClaims: { p1: 0, p2: 0 },
		cooldowns: { p1: null, p2: null },
		config,
		lastClaim: null,
		claimCount: 0,
		revision: 0,
		seed,
		rngState: shuffled.rngState,
		status: "playing",
		winner: null,
		endReason: null,
	};
	return ensureSetTrioPlayable(meta);
}

/**
 * Backfills and canonicalizes serialized snapshots. It deliberately does not
 * draw cards: normalization repairs shape, while game transitions own dealing.
 * Mutates and returns the supplied object to match the other Table engines.
 */
export function normalizeSetTrioMeta(meta: SetTrioMeta): SetTrioMeta {
	const target = meta as SetTrioMeta & Record<string, unknown>;
	const variant = target.variant;
	target.variant =
		variant === "mini" || variant === "wide" || variant === "party" || variant === "classic"
			? variant
			: "classic";
	const seen = new Set<string>();
	target.board = normalizeCards(target.board, seen);
	target.deck = normalizeCards(target.deck, seen);
	target.scores = normalizePlayerRecord(target.scores, toScore);
	target.invalidClaims = normalizePlayerRecord(target.invalidClaims, (entry) =>
		toNonNegativeInteger(entry, 0),
	);
	target.cooldowns = normalizeCooldowns(target.cooldowns);
	target.config = normalizeConfig(target.config);
	target.lastClaim = target.lastClaim && typeof target.lastClaim === "object" ? target.lastClaim : null;
	target.claimCount = toNonNegativeInteger(target.claimCount, 0);
	target.revision = toNonNegativeInteger(target.revision, target.claimCount);
	target.seed = normalizeSeed(target.seed);
	target.rngState = normalizeSeed(target.rngState, target.seed);
	refreshSetTrioDerivedState(target);
	return target;
}

function cloneSetTrioMeta(source: SetTrioMeta): SetTrioMeta {
	return normalizeSetTrioMeta(JSON.parse(JSON.stringify(source)) as SetTrioMeta);
}

type ResolvedClaim = {
	indices: [number, number, number];
	cardIds: [string, string, string];
	cards: [SetTrioCard, SetTrioCard, SetTrioCard];
};

function isThreeItems<T>(items: readonly T[] | undefined): items is readonly [T, T, T] {
	return Array.isArray(items) && items.length === 3;
}

function resolveClaim(meta: SetTrioMeta, move: SetTrioMove): ResolvedClaim | string {
	const suppliedIndices = move?.indices;
	const suppliedIds = move?.cardIds;
	if (!isThreeItems(suppliedIndices) && !isThreeItems(suppliedIds)) {
		return "Claim exactly three cards by board index or card ID.";
	}
	if (suppliedIndices !== undefined && !isThreeItems(suppliedIndices)) {
		return "A Set Trio claim must contain exactly three board indices.";
	}
	if (suppliedIds !== undefined && !isThreeItems(suppliedIds)) {
		return "A Set Trio claim must contain exactly three card IDs.";
	}

	let indices: number[];
	if (isThreeItems(suppliedIndices)) {
		indices = [...suppliedIndices];
		if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= meta.board.length)) {
			return "One or more claimed cards are not on the board.";
		}
	} else {
		const boardIndexById = new Map(meta.board.map((card, index) => [card.id, index]));
		indices = (suppliedIds as readonly string[]).map((id) => boardIndexById.get(id) ?? -1);
		if (indices.some((index) => index < 0)) {
			return "One or more claimed card IDs are stale or not on the board.";
		}
	}

	if (new Set(indices).size !== 3) return "Choose three different cards.";
	const cardIds = indices.map((index) => meta.board[index].id);
	if (new Set(cardIds).size !== 3) return "Choose three different cards.";

	if (isThreeItems(suppliedIds)) {
		if (new Set(suppliedIds).size !== 3) return "Choose three different card IDs.";
		for (let position = 0; position < 3; position += 1) {
			if (typeof suppliedIds[position] !== "string" || suppliedIds[position] !== cardIds[position]) {
				return "The board changed before this claim; select the three cards again.";
			}
		}
	}

	return {
		indices: indices as [number, number, number],
		cardIds: cardIds as [string, string, string],
		cards: indices.map((index) => meta.board[index]) as [SetTrioCard, SetTrioCard, SetTrioCard],
	};
}

function replaceClaimedCards(meta: SetTrioMeta, indices: readonly number[]): void {
	const claimed = new Set(indices);
	if (meta.board.length > SET_TRIO_BASE_BOARD_SIZE) {
		meta.board = meta.board.filter((_, index) => !claimed.has(index));
		return;
	}

	const nextBoard: SetTrioCard[] = [];
	for (let index = 0; index < meta.board.length; index += 1) {
		if (!claimed.has(index)) {
			nextBoard.push(meta.board[index]);
			continue;
		}
		const replacement = meta.deck.shift();
		if (replacement) nextBoard.push(replacement);
	}
	meta.board = nextBoard;
}

export function applySetTrioIntent(
	source: SetTrioMeta,
	player: SetTrioPlayerMark,
	move: SetTrioMove,
): SetTrioIntentResult {
	if (player !== "p1" && player !== "p2") return { ok: false, reason: "Unknown Set Trio player." };
	const meta = cloneSetTrioMeta(source);
	if (meta.status === "finished") return { ok: false, reason: "Set Trio is already finished." };
	const claim = resolveClaim(meta, move);
	if (typeof claim === "string") return { ok: false, reason: claim };

	meta.revision += 1;
	meta.claimCount += 1;
	const point = { row: Math.floor(claim.indices[0] / 4), column: claim.indices[0] % 4 };

	if (!isSetTrioSet(claim.cards[0], claim.cards[1], claim.cards[2])) {
		const scoreDelta = -meta.config.invalidClaimPenalty;
		meta.scores[player] += scoreDelta;
		meta.invalidClaims[player] += 1;
		meta.cooldowns[player] = {
			durationMs: meta.config.invalidClaimCooldownMs,
			issuedAtRevision: meta.revision,
			reason: "invalid-set",
		};
		meta.lastClaim = {
			player,
			indices: claim.indices,
			cardIds: claim.cardIds,
			valid: false,
			scoreDelta,
			reason: "invalid-set",
			revision: meta.revision,
			cooldownMs: meta.config.invalidClaimCooldownMs,
		};
		refreshSetTrioDerivedState(meta);
		return { ok: true, point, meta, nextTurn: player, winner: meta.winner };
	}

	meta.scores[player] += meta.config.validClaimPoints;
	meta.cooldowns[player] = null;
	meta.lastClaim = {
		player,
		indices: claim.indices,
		cardIds: claim.cardIds,
		valid: true,
		scoreDelta: meta.config.validClaimPoints,
		reason: "set",
		revision: meta.revision,
		cooldownMs: 0,
	};
	replaceClaimedCards(meta, claim.indices);
	ensureSetTrioPlayable(meta);
	return { ok: true, point, meta, nextTurn: player, winner: meta.winner };
}

/** Convenience helper for the safest online claim form. */
export function claimSetTrioByCardIds(
	meta: SetTrioMeta,
	player: SetTrioPlayerMark,
	cardIds: readonly string[],
): SetTrioIntentResult {
	return applySetTrioIntent(meta, player, { cardIds });
}

export function getSetTrioLegalMoves(
	meta: SetTrioMeta,
	_player: SetTrioPlayerMark,
): SetTrioLegalMove[] {
	if (meta.status === "finished") return [];
	return findSetTrioSets(meta.board);
}

function simulateBoardAfterClaim(meta: SetTrioMeta, move: SetTrioLegalMove): SetTrioCard[] {
	const preview = cloneSetTrioMeta(meta);
	replaceClaimedCards(preview, move.indices);
	ensureSetTrioPlayable(preview);
	return preview.board;
}

function deterministicChoiceIndex(meta: SetTrioMeta, count: number, salt: number): number {
	if (count <= 1) return 0;
	const state = normalizeSeed(meta.seed ^ Math.imul(meta.revision + 1, salt));
	return Math.floor(nextRandom(state).value * count);
}

export function chooseSetTrioBotMove(
	meta: SetTrioMeta,
	player: SetTrioPlayerMark,
	legalMoves: readonly SetTrioLegalMove[],
	difficulty: SetTrioDifficulty,
): SetTrioLegalMove {
	if (legalMoves.length === 0) {
		return { indices: [-1, -1, -1], cardIds: ["", "", ""] };
	}

	if (difficulty === "casual") {
		return legalMoves[deterministicChoiceIndex(meta, legalMoves.length, player === "p1" ? 0x9e3779b1 : 0x85ebca6b)];
	}

	if (difficulty === "sharp") {
		// Stable center-weighted choice: less scan distance for a human-like bot.
		return [...legalMoves].sort((a, b) => {
			const aSpread = a.indices[2] - a.indices[0];
			const bSpread = b.indices[2] - b.indices[0];
			return aSpread - bSpread || a.indices[0] - b.indices[0];
		})[0];
	}

	// Ruthless looks through the known authoritative draw order and leaves the
	// richest follow-up board, with a deterministic index tie-break.
	let best = legalMoves[0];
	let bestFollowUps = -1;
	let bestBoardSize = Number.POSITIVE_INFINITY;
	for (const move of legalMoves) {
		const board = simulateBoardAfterClaim(meta, move);
		const followUps = findSetTrioSets(board).length;
		if (
			followUps > bestFollowUps ||
			(followUps === bestFollowUps && board.length < bestBoardSize) ||
			(followUps === bestFollowUps && board.length === bestBoardSize && move.indices[0] < best.indices[0])
		) {
			best = move;
			bestFollowUps = followUps;
			bestBoardSize = board.length;
		}
	}
	return best;
}
