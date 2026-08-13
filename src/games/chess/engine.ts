// A self-contained, server-authoritative chess engine.
//
// Board indices follow the rest of Table Games: 0 is a8, 7 is h8, 56 is a1,
// and 63 is h1. Uppercase pieces are White and lowercase pieces are Black.

export type ChessPlayerMark = "p1" | "p2" | "p3" | "p4";
export type ChessDuelMark = "p1" | "p2";
export type ChessWinner = ChessDuelMark | "draw" | null;
export type ChessDifficulty = "casual" | "sharp" | "ruthless";
export type ChessVariant = "mini" | "classic" | "wide" | "party";
export type ChessColor = "white" | "black";
export type ChessPromotion = "q" | "r" | "b" | "n";
export type ChessPiece =
	| ""
	| "P"
	| "N"
	| "B"
	| "R"
	| "Q"
	| "K"
	| "p"
	| "n"
	| "b"
	| "r"
	| "q"
	| "k";

export type ChessMoveKind =
	| "quiet"
	| "capture"
	| "double-pawn"
	| "en-passant"
	| "castle-kingside"
	| "castle-queenside"
	| "promotion"
	| "promotion-capture";

/** Canonical move shape returned by the engine. Every property is explicit for stable JSON. */
export interface ChessMove {
	from: number;
	to: number;
	promotion: ChessPromotion | null;
	kind: ChessMoveKind;
}

/** Minimal client intent. The server derives capture/castling/en-passant flags itself. */
export interface ChessMoveIntent {
	from: number;
	to: number;
	promotion?: ChessPromotion | null;
}

export interface ChessCastlingRights {
	whiteKingSide: boolean;
	whiteQueenSide: boolean;
	blackKingSide: boolean;
	blackQueenSide: boolean;
}

export interface ChessMeta {
	board: ChessPiece[];
	turn: ChessColor;
	castling: ChessCastlingRights;
	enPassant: number | null;
	halfmoveClock: number;
	fullmoveNumber: number;
	/** Position keys, including the current position, used for threefold repetition. */
	history: string[];
	lastMove: ChessMove | null;
	/** Stable entropy for deterministic bot choices. It is deliberately not part of a position key. */
	seed: number;
}

export type ChessStatusReason =
	| "checkmate"
	| "stalemate"
	| "fifty-move"
	| "threefold-repetition"
	| "insufficient-material"
	| null;

export interface ChessStatus {
	state: "active" | "check" | "checkmate" | "draw";
	reason: ChessStatusReason;
	inCheck: boolean;
	winner: ChessColor | null;
	legalMoveCount: number;
}

export interface ChessPoint {
	row: number;
	column: number;
}

export type ChessIntentResult =
	| {
			ok: true;
			point: ChessPoint;
			meta: ChessMeta;
			nextTurn: ChessDuelMark;
			winner: ChessWinner;
			status: ChessStatus;
	  }
	| { ok: false; reason: string };

export interface ChessBotOptions {
	/** Optional deterministic test/game RNG. Values are normalized into [0, 1). */
	rng?: () => number;
	/** Overrides are clamped so callers cannot accidentally create an unbounded search. */
	maxDepth?: number;
	maxNodes?: number;
}

export const CHESS_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const START_BOARD: ChessPiece[] = [
	"r", "n", "b", "q", "k", "b", "n", "r",
	"p", "p", "p", "p", "p", "p", "p", "p",
	"", "", "", "", "", "", "", "",
	"", "", "", "", "", "", "", "",
	"", "", "", "", "", "", "", "",
	"", "", "", "", "", "", "", "",
	"P", "P", "P", "P", "P", "P", "P", "P",
	"R", "N", "B", "Q", "K", "B", "N", "R",
];

const EMPTY_CASTLING: ChessCastlingRights = {
	whiteKingSide: false,
	whiteQueenSide: false,
	blackKingSide: false,
	blackQueenSide: false,
};

const FULL_CASTLING: ChessCastlingRights = {
	whiteKingSide: true,
	whiteQueenSide: true,
	blackKingSide: true,
	blackQueenSide: true,
};

const KNIGHT_STEPS: ReadonlyArray<readonly [number, number]> = [
	[-2, -1], [-2, 1], [-1, -2], [-1, 2],
	[1, -2], [1, 2], [2, -1], [2, 1],
];

const KING_STEPS: ReadonlyArray<readonly [number, number]> = [
	[-1, -1], [-1, 0], [-1, 1], [0, -1],
	[0, 1], [1, -1], [1, 0], [1, 1],
];

const BISHOP_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
	[-1, -1], [-1, 1], [1, -1], [1, 1],
];

const ROOK_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
	[-1, 0], [0, -1], [0, 1], [1, 0],
];

const PROMOTIONS: readonly ChessPromotion[] = ["q", "r", "b", "n"];
const PIECES = new Set<ChessPiece>(["", "P", "N", "B", "R", "Q", "K", "p", "n", "b", "r", "q", "k"]);
const DEFAULT_SEED = 0x9e3779b9;
const MAX_HISTORY = 256;
const MATE_SCORE = 1_000_000;

function isBoardIndex(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 64;
}

function isPiece(value: unknown): value is ChessPiece {
	return typeof value === "string" && PIECES.has(value as ChessPiece);
}

function isPromotion(value: unknown): value is ChessPromotion {
	return value === "q" || value === "r" || value === "b" || value === "n";
}

function isMoveKind(value: unknown): value is ChessMoveKind {
	return value === "quiet" || value === "capture" || value === "double-pawn" ||
		value === "en-passant" || value === "castle-kingside" ||
		value === "castle-queenside" || value === "promotion" ||
		value === "promotion-capture";
}

function isCanonicalMove(value: unknown): value is ChessMove {
	if (!value || typeof value !== "object") return false;
	const move = value as Partial<ChessMove>;
	return isBoardIndex(move.from) && isBoardIndex(move.to) &&
		(move.promotion === null || isPromotion(move.promotion)) && isMoveKind(move.kind);
}

function colorOf(piece: ChessPiece): ChessColor | null {
	if (piece === "") return null;
	return piece === piece.toUpperCase() ? "white" : "black";
}

function opposite(color: ChessColor): ChessColor {
	return color === "white" ? "black" : "white";
}

function pieceType(piece: ChessPiece): Uppercase<Exclude<ChessPiece, "">> | "" {
	return piece.toUpperCase() as Uppercase<Exclude<ChessPiece, "">> | "";
}

function onBoard(row: number, column: number): boolean {
	return row >= 0 && row < 8 && column >= 0 && column < 8;
}

function rowOf(index: number): number {
	return Math.floor(index / 8);
}

function columnOf(index: number): number {
	return index % 8;
}

function copyCastling(rights: ChessCastlingRights): ChessCastlingRights {
	return { ...rights };
}

function cloneMeta(meta: ChessMeta): ChessMeta {
	return {
		board: [...meta.board],
		turn: meta.turn,
		castling: copyCastling(meta.castling),
		enPassant: meta.enPassant,
		halfmoveClock: meta.halfmoveClock,
		fullmoveNumber: meta.fullmoveNumber,
		history: [...meta.history],
		lastMove: meta.lastMove ? { ...meta.lastMove } : null,
		seed: meta.seed >>> 0,
	};
}

function playerColor(player: ChessPlayerMark): ChessColor | null {
	if (player === "p1") return "white";
	if (player === "p2") return "black";
	return null;
}

function playerForColor(color: ChessColor): ChessDuelMark {
	return color === "white" ? "p1" : "p2";
}

export function chessSquareToIndex(square: string): number {
	if (!/^[a-h][1-8]$/.test(square)) return -1;
	const column = square.charCodeAt(0) - 97;
	const rank = Number(square[1]);
	return (8 - rank) * 8 + column;
}

export function chessIndexToSquare(index: number): string {
	if (!isBoardIndex(index)) return "";
	return `${String.fromCharCode(97 + columnOf(index))}${8 - rowOf(index)}`;
}

function castlingString(rights: ChessCastlingRights): string {
	let value = "";
	if (rights.whiteKingSide) value += "K";
	if (rights.whiteQueenSide) value += "Q";
	if (rights.blackKingSide) value += "k";
	if (rights.blackQueenSide) value += "q";
	return value || "-";
}

function parseCastling(value: unknown): ChessCastlingRights {
	if (typeof value === "string") {
		return {
			whiteKingSide: value.includes("K"),
			whiteQueenSide: value.includes("Q"),
			blackKingSide: value.includes("k"),
			blackQueenSide: value.includes("q"),
		};
	}
	if (value && typeof value === "object") {
		const rights = value as Partial<ChessCastlingRights>;
		return {
			whiteKingSide: rights.whiteKingSide === true,
			whiteQueenSide: rights.whiteQueenSide === true,
			blackKingSide: rights.blackKingSide === true,
			blackQueenSide: rights.blackQueenSide === true,
		};
	}
	return { ...EMPTY_CASTLING };
}

function constrainCastlingToBoard(rights: ChessCastlingRights, board: ChessPiece[]): ChessCastlingRights {
	return {
		whiteKingSide: rights.whiteKingSide && board[60] === "K" && board[63] === "R",
		whiteQueenSide: rights.whiteQueenSide && board[60] === "K" && board[56] === "R",
		blackKingSide: rights.blackKingSide && board[4] === "k" && board[7] === "r",
		blackQueenSide: rights.blackQueenSide && board[4] === "k" && board[0] === "r",
	};
}

function normalizeEnPassant(value: unknown, board: ChessPiece[], turn: ChessColor): number | null {
	if (!isBoardIndex(value) || board[value] !== "") return null;
	const row = rowOf(value);
	if (turn === "white") {
		return row === 2 && board[value + 8] === "p" ? value : null;
	}
	return row === 5 && board[value - 8] === "P" ? value : null;
}

function boardPlacement(board: ChessPiece[]): string {
	const ranks: string[] = [];
	for (let row = 0; row < 8; row += 1) {
		let rank = "";
		let empty = 0;
		for (let column = 0; column < 8; column += 1) {
			const piece = board[row * 8 + column];
			if (piece === "") {
				empty += 1;
			} else {
				if (empty > 0) rank += String(empty);
				empty = 0;
				rank += piece;
			}
		}
		if (empty > 0) rank += String(empty);
		ranks.push(rank);
	}
	return ranks.join("/");
}

function parseBoardPlacement(placement: string): ChessPiece[] | null {
	const ranks = placement.split("/");
	if (ranks.length !== 8) return null;
	const board: ChessPiece[] = [];
	for (const rank of ranks) {
		let columns = 0;
		for (const token of rank) {
			if (/^[1-8]$/.test(token)) {
				const empty = Number(token);
				columns += empty;
				for (let i = 0; i < empty; i += 1) board.push("");
			} else if (isPiece(token) && token !== "") {
				columns += 1;
				board.push(token);
			} else {
				return null;
			}
		}
		if (columns !== 8) return null;
	}
	return board.length === 64 ? board : null;
}

function validKings(board: ChessPiece[]): boolean {
	return board.filter((piece) => piece === "K").length === 1 &&
		board.filter((piece) => piece === "k").length === 1;
}

function normalizedInteger(value: unknown, fallback: number, minimum: number): number {
	return typeof value === "number" && Number.isFinite(value)
		? Math.max(minimum, Math.floor(value))
		: fallback;
}

function nextSeed(seed: number, salt: number): number {
	let value = (seed ^ salt ^ DEFAULT_SEED) >>> 0;
	value ^= value << 13;
	value ^= value >>> 17;
	value ^= value << 5;
	return (value >>> 0) || DEFAULT_SEED;
}

function createBaseMeta(): ChessMeta {
	return {
		board: [...START_BOARD],
		turn: "white",
		castling: { ...FULL_CASTLING },
		enPassant: null,
		halfmoveClock: 0,
		fullmoveNumber: 1,
		history: [],
		lastMove: null,
		seed: DEFAULT_SEED,
	};
}

export function createChessMeta(_variant: ChessVariant = "classic"): ChessMeta {
	const meta = createBaseMeta();
	meta.history = [chessPositionKeyUnchecked(meta)];
	return meta;
}

export function normalizeChessMeta(source: Partial<ChessMeta> | null | undefined): ChessMeta {
	const raw = source ?? {};
	const suppliedBoard = Array.isArray(raw.board) && raw.board.length === 64 && raw.board.every(isPiece)
		? [...raw.board] as ChessPiece[]
		: null;
	const board = suppliedBoard && validKings(suppliedBoard) ? suppliedBoard : [...START_BOARD];
	const turn: ChessColor = raw.turn === "black" ? "black" : "white";
	const requestedCastling = raw.castling === undefined && !suppliedBoard
		? { ...FULL_CASTLING }
		: parseCastling(raw.castling);
	const meta: ChessMeta = {
		board,
		turn,
		castling: constrainCastlingToBoard(requestedCastling, board),
		enPassant: null,
		halfmoveClock: normalizedInteger(raw.halfmoveClock, 0, 0),
		fullmoveNumber: normalizedInteger(raw.fullmoveNumber, 1, 1),
		history: Array.isArray(raw.history)
			? raw.history.filter((entry): entry is string => typeof entry === "string").slice(-MAX_HISTORY)
			: [],
		lastMove: isCanonicalMove(raw.lastMove) ? { ...raw.lastMove } : null,
		seed: normalizedInteger(raw.seed, DEFAULT_SEED, 1) >>> 0,
	};
	meta.enPassant = normalizeEnPassant(raw.enPassant, meta.board, meta.turn);
	const key = chessPositionKeyUnchecked(meta);
	if (meta.history.at(-1) !== key) meta.history.push(key);
	if (meta.history.length > MAX_HISTORY) meta.history = meta.history.slice(-MAX_HISTORY);
	return meta;
}

export function createChessMetaFromFen(fen: string, history: readonly string[] = []): ChessMeta {
	const fields = fen.trim().split(/\s+/);
	if (fields.length !== 6) throw new Error("A chess FEN must contain exactly six fields.");
	const board = parseBoardPlacement(fields[0]);
	if (!board || !validKings(board)) throw new Error("The chess FEN has an invalid board or king count.");
	if (fields[1] !== "w" && fields[1] !== "b") throw new Error("The chess FEN has an invalid active color.");
	if (!/^(?:-|K?Q?k?q?)$/.test(fields[2])) throw new Error("The chess FEN has invalid castling rights.");
	const enPassant = fields[3] === "-" ? null : chessSquareToIndex(fields[3]);
	if (enPassant === -1) throw new Error("The chess FEN has an invalid en-passant square.");
	if (!/^\d+$/.test(fields[4]) || !/^\d+$/.test(fields[5]) || Number(fields[5]) < 1) {
		throw new Error("The chess FEN has invalid move counters.");
	}
	return normalizeChessMeta({
		board,
		turn: fields[1] === "w" ? "white" : "black",
		castling: parseCastling(fields[2]),
		enPassant,
		halfmoveClock: Number(fields[4]),
		fullmoveNumber: Number(fields[5]),
		history: [...history],
		lastMove: null,
		seed: DEFAULT_SEED,
	});
}

export function chessMetaToFen(source: ChessMeta): string {
	const meta = normalizeChessMeta(source);
	return [
		boardPlacement(meta.board),
		meta.turn === "white" ? "w" : "b",
		castlingString(meta.castling),
		meta.enPassant === null ? "-" : chessIndexToSquare(meta.enPassant),
		String(meta.halfmoveClock),
		String(meta.fullmoveNumber),
	].join(" ");
}

function findKing(board: ChessPiece[], color: ChessColor): number {
	return board.indexOf(color === "white" ? "K" : "k");
}

function isSquareAttacked(board: ChessPiece[], square: number, byColor: ChessColor): boolean {
	const row = rowOf(square);
	const column = columnOf(square);
	const pawn = byColor === "white" ? "P" : "p";
	const pawnSourceRow = row + (byColor === "white" ? 1 : -1);
	for (const dc of [-1, 1]) {
		const sourceColumn = column + dc;
		if (onBoard(pawnSourceRow, sourceColumn) && board[pawnSourceRow * 8 + sourceColumn] === pawn) {
			return true;
		}
	}

	const knight = byColor === "white" ? "N" : "n";
	for (const [dr, dc] of KNIGHT_STEPS) {
		const r = row + dr;
		const c = column + dc;
		if (onBoard(r, c) && board[r * 8 + c] === knight) return true;
	}

	const king = byColor === "white" ? "K" : "k";
	for (const [dr, dc] of KING_STEPS) {
		const r = row + dr;
		const c = column + dc;
		if (onBoard(r, c) && board[r * 8 + c] === king) return true;
	}

	for (const [dr, dc] of BISHOP_DIRECTIONS) {
		let r = row + dr;
		let c = column + dc;
		while (onBoard(r, c)) {
			const piece = board[r * 8 + c];
			if (piece !== "") {
				if (colorOf(piece) === byColor && (pieceType(piece) === "B" || pieceType(piece) === "Q")) return true;
				break;
			}
			r += dr;
			c += dc;
		}
	}

	for (const [dr, dc] of ROOK_DIRECTIONS) {
		let r = row + dr;
		let c = column + dc;
		while (onBoard(r, c)) {
			const piece = board[r * 8 + c];
			if (piece !== "") {
				if (colorOf(piece) === byColor && (pieceType(piece) === "R" || pieceType(piece) === "Q")) return true;
				break;
			}
			r += dr;
			c += dc;
		}
	}
	return false;
}

function inCheckUnchecked(meta: ChessMeta, color: ChessColor): boolean {
	const king = findKing(meta.board, color);
	return king < 0 || isSquareAttacked(meta.board, king, opposite(color));
}

export function isChessInCheck(source: ChessMeta, color?: ChessColor): boolean {
	const meta = normalizeChessMeta(source);
	return inCheckUnchecked(meta, color ?? meta.turn);
}

function pushPawnMove(
	moves: ChessMove[],
	from: number,
	to: number,
	capture: boolean,
	promotion: boolean,
): void {
	if (promotion) {
		for (const piece of PROMOTIONS) {
			moves.push({
				from,
				to,
				promotion: piece,
				kind: capture ? "promotion-capture" : "promotion",
			});
		}
		return;
	}
	moves.push({ from, to, promotion: null, kind: capture ? "capture" : "quiet" });
}

function addCastlingMoves(meta: ChessMeta, moves: ChessMove[]): void {
	const { board, castling, turn } = meta;
	if (turn === "white" && board[60] === "K") {
		if (castling.whiteKingSide && board[61] === "" && board[62] === "" && board[63] === "R" &&
			!isSquareAttacked(board, 60, "black") && !isSquareAttacked(board, 61, "black") &&
			!isSquareAttacked(board, 62, "black")) {
			moves.push({ from: 60, to: 62, promotion: null, kind: "castle-kingside" });
		}
		if (castling.whiteQueenSide && board[59] === "" && board[58] === "" && board[57] === "" && board[56] === "R" &&
			!isSquareAttacked(board, 60, "black") && !isSquareAttacked(board, 59, "black") &&
			!isSquareAttacked(board, 58, "black")) {
			moves.push({ from: 60, to: 58, promotion: null, kind: "castle-queenside" });
		}
	}
	if (turn === "black" && board[4] === "k") {
		if (castling.blackKingSide && board[5] === "" && board[6] === "" && board[7] === "r" &&
			!isSquareAttacked(board, 4, "white") && !isSquareAttacked(board, 5, "white") &&
			!isSquareAttacked(board, 6, "white")) {
			moves.push({ from: 4, to: 6, promotion: null, kind: "castle-kingside" });
		}
		if (castling.blackQueenSide && board[3] === "" && board[2] === "" && board[1] === "" && board[0] === "r" &&
			!isSquareAttacked(board, 4, "white") && !isSquareAttacked(board, 3, "white") &&
			!isSquareAttacked(board, 2, "white")) {
			moves.push({ from: 4, to: 2, promotion: null, kind: "castle-queenside" });
		}
	}
}

function generatePseudoLegalMoves(meta: ChessMeta): ChessMove[] {
	const { board, turn } = meta;
	const moves: ChessMove[] = [];
	for (let from = 0; from < 64; from += 1) {
		const piece = board[from];
		if (piece === "" || colorOf(piece) !== turn) continue;
		const row = rowOf(from);
		const column = columnOf(from);
		const type = pieceType(piece);

		if (type === "P") {
			const direction = turn === "white" ? -1 : 1;
			const startRow = turn === "white" ? 6 : 1;
			const promotionRow = turn === "white" ? 0 : 7;
			const nextRow = row + direction;
			if (onBoard(nextRow, column) && board[nextRow * 8 + column] === "") {
				pushPawnMove(moves, from, nextRow * 8 + column, false, nextRow === promotionRow);
				const doubleRow = row + direction * 2;
				if (row === startRow && board[doubleRow * 8 + column] === "") {
					moves.push({ from, to: doubleRow * 8 + column, promotion: null, kind: "double-pawn" });
				}
			}
			for (const dc of [-1, 1]) {
				const captureColumn = column + dc;
				if (!onBoard(nextRow, captureColumn)) continue;
				const to = nextRow * 8 + captureColumn;
				const target = board[to];
				if (target !== "" && colorOf(target) !== turn && pieceType(target) !== "K") {
					pushPawnMove(moves, from, to, true, nextRow === promotionRow);
				} else if (to === meta.enPassant && target === "") {
					const captured = turn === "white" ? to + 8 : to - 8;
					if (board[captured] === (turn === "white" ? "p" : "P")) {
						moves.push({ from, to, promotion: null, kind: "en-passant" });
					}
				}
			}
			continue;
		}

		if (type === "N" || type === "K") {
			const steps = type === "N" ? KNIGHT_STEPS : KING_STEPS;
			for (const [dr, dc] of steps) {
				const targetRow = row + dr;
				const targetColumn = column + dc;
				if (!onBoard(targetRow, targetColumn)) continue;
				const to = targetRow * 8 + targetColumn;
				const target = board[to];
				if (target === "") {
					moves.push({ from, to, promotion: null, kind: "quiet" });
				} else if (colorOf(target) !== turn && pieceType(target) !== "K") {
					moves.push({ from, to, promotion: null, kind: "capture" });
				}
			}
			if (type === "K") addCastlingMoves(meta, moves);
			continue;
		}

		const directions = type === "B"
			? BISHOP_DIRECTIONS
			: type === "R"
				? ROOK_DIRECTIONS
				: [...BISHOP_DIRECTIONS, ...ROOK_DIRECTIONS];
		for (const [dr, dc] of directions) {
			let targetRow = row + dr;
			let targetColumn = column + dc;
			while (onBoard(targetRow, targetColumn)) {
				const to = targetRow * 8 + targetColumn;
				const target = board[to];
				if (target === "") {
					moves.push({ from, to, promotion: null, kind: "quiet" });
				} else {
					if (colorOf(target) !== turn && pieceType(target) !== "K") {
						moves.push({ from, to, promotion: null, kind: "capture" });
					}
					break;
				}
				targetRow += dr;
				targetColumn += dc;
			}
		}
	}
	return moves;
}

function promotionOrder(promotion: ChessPromotion | null): number {
	return promotion === null ? -1 : PROMOTIONS.indexOf(promotion);
}

function compareMoves(a: ChessMove, b: ChessMove): number {
	return a.from - b.from || a.to - b.to || promotionOrder(a.promotion) - promotionOrder(b.promotion) ||
		a.kind.localeCompare(b.kind);
}

function revokeRookRight(rights: ChessCastlingRights, square: number): void {
	if (square === 63) rights.whiteKingSide = false;
	if (square === 56) rights.whiteQueenSide = false;
	if (square === 7) rights.blackKingSide = false;
	if (square === 0) rights.blackQueenSide = false;
}

function makeMoveUnchecked(source: ChessMeta, move: ChessMove, recordHistory: boolean): ChessMeta {
	const meta = cloneMeta(source);
	const color = source.turn;
	const movingPiece = meta.board[move.from];
	let capturedPiece = meta.board[move.to];
	meta.board[move.from] = "";
	meta.board[move.to] = movingPiece;

	if (move.kind === "en-passant") {
		const capturedSquare = color === "white" ? move.to + 8 : move.to - 8;
		capturedPiece = meta.board[capturedSquare];
		meta.board[capturedSquare] = "";
	}
	if (move.promotion !== null) {
		meta.board[move.to] = (color === "white" ? move.promotion.toUpperCase() : move.promotion) as ChessPiece;
	}
	if (move.kind === "castle-kingside") {
		const rookFrom = color === "white" ? 63 : 7;
		const rookTo = color === "white" ? 61 : 5;
		meta.board[rookTo] = meta.board[rookFrom];
		meta.board[rookFrom] = "";
	}
	if (move.kind === "castle-queenside") {
		const rookFrom = color === "white" ? 56 : 0;
		const rookTo = color === "white" ? 59 : 3;
		meta.board[rookTo] = meta.board[rookFrom];
		meta.board[rookFrom] = "";
	}

	if (movingPiece === "K") {
		meta.castling.whiteKingSide = false;
		meta.castling.whiteQueenSide = false;
	} else if (movingPiece === "k") {
		meta.castling.blackKingSide = false;
		meta.castling.blackQueenSide = false;
	}
	revokeRookRight(meta.castling, move.from);
	revokeRookRight(meta.castling, move.to);
	meta.enPassant = move.kind === "double-pawn"
		? move.from + (color === "white" ? -8 : 8)
		: null;
	const irreversible = pieceType(movingPiece) === "P" || capturedPiece !== "";
	meta.halfmoveClock = irreversible ? 0 : source.halfmoveClock + 1;
	meta.fullmoveNumber = source.fullmoveNumber + (color === "black" ? 1 : 0);
	meta.turn = opposite(color);
	meta.lastMove = { ...move };
	meta.seed = nextSeed(source.seed, move.from * 131 + move.to * 17 + promotionOrder(move.promotion) + 2);

	if (recordHistory) {
		const key = chessPositionKeyUnchecked(meta);
		meta.history = irreversible ? [key] : [...source.history, key].slice(-MAX_HISTORY);
	}
	return meta;
}

function generateLegalMovesUnchecked(meta: ChessMeta): ChessMove[] {
	const movingColor = meta.turn;
	return generatePseudoLegalMoves(meta)
		.filter((move) => !inCheckUnchecked(makeMoveUnchecked(meta, move, false), movingColor))
		.sort(compareMoves);
}

function hasLegalEnPassantCapture(meta: ChessMeta): boolean {
	if (meta.enPassant === null) return false;
	const movingColor = meta.turn;
	return generatePseudoLegalMoves(meta).some(
		(move) => move.kind === "en-passant" && !inCheckUnchecked(makeMoveUnchecked(meta, move, false), movingColor),
	);
}

function chessPositionKeyUnchecked(meta: ChessMeta): string {
	const effectiveEnPassant = hasLegalEnPassantCapture(meta) && meta.enPassant !== null
		? chessIndexToSquare(meta.enPassant)
		: "-";
	return `${boardPlacement(meta.board)} ${meta.turn === "white" ? "w" : "b"} ${castlingString(meta.castling)} ${effectiveEnPassant}`;
}

/** FIDE repetition key: placement, active color, castling rights, and only an effective en-passant right. */
export function chessPositionKey(source: ChessMeta): string {
	return chessPositionKeyUnchecked(normalizeChessMeta(source));
}

export function getChessLegalMoves(source: ChessMeta, player?: ChessPlayerMark): ChessMove[] {
	const meta = normalizeChessMeta(source);
	if (player !== undefined && playerColor(player) !== meta.turn) return [];
	return generateLegalMovesUnchecked(meta);
}

export function isInsufficientChessMaterial(source: ChessMeta): boolean {
	const meta = normalizeChessMeta(source);
	const material = meta.board
		.map((piece, square) => ({ piece, square }))
		.filter(({ piece }) => piece !== "" && pieceType(piece) !== "K");
	if (material.some(({ piece }) => pieceType(piece) === "P" || pieceType(piece) === "R" || pieceType(piece) === "Q")) {
		return false;
	}
	if (material.length === 0) return true;
	if (material.length === 1) return pieceType(material[0].piece) === "B" || pieceType(material[0].piece) === "N";
	if (material.every(({ piece }) => pieceType(piece) === "B")) {
		const squareColors = new Set(material.map(({ square }) => (rowOf(square) + columnOf(square)) % 2));
		return squareColors.size === 1;
	}
	return false;
}

function statusUnchecked(meta: ChessMeta): ChessStatus {
	const inCheck = inCheckUnchecked(meta, meta.turn);
	const legalMoveCount = generateLegalMovesUnchecked(meta).length;
	if (legalMoveCount === 0) {
		if (inCheck) {
			return {
				state: "checkmate",
				reason: "checkmate",
				inCheck: true,
				winner: opposite(meta.turn),
				legalMoveCount: 0,
			};
		}
		return { state: "draw", reason: "stalemate", inCheck: false, winner: null, legalMoveCount: 0 };
	}
	if (meta.halfmoveClock >= 100) {
		return { state: "draw", reason: "fifty-move", inCheck, winner: null, legalMoveCount };
	}
	const key = chessPositionKeyUnchecked(meta);
	if (meta.history.filter((entry) => entry === key).length >= 3) {
		return { state: "draw", reason: "threefold-repetition", inCheck, winner: null, legalMoveCount };
	}
	if (isInsufficientChessMaterial(meta)) {
		return { state: "draw", reason: "insufficient-material", inCheck, winner: null, legalMoveCount };
	}
	return {
		state: inCheck ? "check" : "active",
		reason: null,
		inCheck,
		winner: null,
		legalMoveCount,
	};
}

export function getChessStatus(source: ChessMeta): ChessStatus {
	return statusUnchecked(normalizeChessMeta(source));
}

function sameMoveIntent(move: ChessMove, intent: ChessMoveIntent): boolean {
	return move.from === intent.from && move.to === intent.to && move.promotion === (intent.promotion ?? null);
}

export function applyChessIntent(
	source: ChessMeta,
	player: ChessPlayerMark,
	intent: ChessMoveIntent,
): ChessIntentResult {
	const meta = normalizeChessMeta(source);
	const color = playerColor(player);
	if (color === null) return { ok: false, reason: "Chess supports two players." };
	if (color !== meta.turn) return { ok: false, reason: "It isn't that player's turn." };
	const before = statusUnchecked(meta);
	if (before.state === "checkmate" || before.state === "draw") {
		return { ok: false, reason: "The chess game is already over." };
	}
	if (!isBoardIndex(intent.from) || !isBoardIndex(intent.to) ||
		(intent.promotion !== undefined && intent.promotion !== null && !isPromotion(intent.promotion))) {
		return { ok: false, reason: "Choose a valid chess move." };
	}
	const move = generateLegalMovesUnchecked(meta).find((candidate) => sameMoveIntent(candidate, intent));
	if (!move) return { ok: false, reason: "That chess move isn't legal." };
	const next = makeMoveUnchecked(meta, move, true);
	const status = statusUnchecked(next);
	const winner: ChessWinner = status.state === "checkmate"
		? playerForColor(status.winner as ChessColor)
		: status.state === "draw"
			? "draw"
			: null;
	return {
		ok: true,
		point: { row: rowOf(move.to), column: columnOf(move.to) },
		meta: next,
		nextTurn: playerForColor(next.turn),
		winner,
		status,
	};
}

export function chessPerft(source: ChessMeta, depth: number): number {
	if (!Number.isInteger(depth) || depth < 0) throw new Error("Perft depth must be a non-negative integer.");
	const root = normalizeChessMeta(source);
	function count(meta: ChessMeta, remaining: number): number {
		if (remaining === 0) return 1;
		let nodes = 0;
		for (const move of generateLegalMovesUnchecked(meta)) {
			nodes += count(makeMoveUnchecked(meta, move, false), remaining - 1);
		}
		return nodes;
	}
	return count(root, depth);
}

const PIECE_VALUES: Record<string, number> = { P: 100, N: 320, B: 335, R: 500, Q: 900, K: 0 };

const PIECE_SQUARE_TABLES: Record<string, readonly number[]> = {
	P: [
		0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50,
		10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
		0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5,
		5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
	],
	N: [
		-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40,
		-30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
		-30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30,
		-40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
	],
	B: [
		-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10,
		-10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
		-10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
		-10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
	],
	R: [
		0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5,
		-5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
		-5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
		-5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
	],
	Q: [
		-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10,
		-10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
		0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10,
		-10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
	],
	K: [
		-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
		-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
		-20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
		20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
	],
};

function mirrorSquare(square: number): number {
	return (7 - rowOf(square)) * 8 + columnOf(square);
}

function evaluateWhite(meta: ChessMeta): number {
	let score = 0;
	let whiteBishops = 0;
	let blackBishops = 0;
	for (let square = 0; square < 64; square += 1) {
		const piece = meta.board[square];
		if (piece === "") continue;
		const type = pieceType(piece);
		const white = colorOf(piece) === "white";
		const positional = PIECE_SQUARE_TABLES[type]?.[white ? square : mirrorSquare(square)] ?? 0;
		const value = (PIECE_VALUES[type] ?? 0) + positional;
		score += white ? value : -value;
		if (type === "B") {
			if (white) whiteBishops += 1;
			else blackBishops += 1;
		}
	}
	if (whiteBishops >= 2) score += 25;
	if (blackBishops >= 2) score -= 25;
	return score;
}

function evaluateForTurn(meta: ChessMeta): number {
	const score = evaluateWhite(meta);
	return meta.turn === "white" ? score : -score;
}

function capturedPieceForMove(meta: ChessMeta, move: ChessMove): ChessPiece {
	if (move.kind === "en-passant") return meta.turn === "white" ? "p" : "P";
	return meta.board[move.to];
}

function tacticalMoveScore(meta: ChessMeta, move: ChessMove): number {
	const captured = capturedPieceForMove(meta, move);
	const moving = meta.board[move.from];
	let score = captured === "" ? 0 : 10 * (PIECE_VALUES[pieceType(captured)] ?? 0) - (PIECE_VALUES[pieceType(moving)] ?? 0);
	if (move.promotion !== null) score += PIECE_VALUES[move.promotion.toUpperCase()] ?? 0;
	if (move.kind === "castle-kingside" || move.kind === "castle-queenside") score += 40;
	return score;
}

function orderSearchMoves(meta: ChessMeta, moves: readonly ChessMove[]): ChessMove[] {
	return [...moves].sort((a, b) => tacticalMoveScore(meta, b) - tacticalMoveScore(meta, a) || compareMoves(a, b));
}

interface SearchContext {
	nodes: number;
	maxNodes: number;
}

function isRuleDrawUnchecked(meta: ChessMeta): boolean {
	if (meta.halfmoveClock >= 100 || isInsufficientChessMaterial(meta)) return true;
	const key = chessPositionKeyUnchecked(meta);
	return meta.history.filter((entry) => entry === key).length >= 3;
}

function quiescence(
	meta: ChessMeta,
	alphaStart: number,
	beta: number,
	context: SearchContext,
	remaining: number,
): number {
	context.nodes += 1;
	if (context.nodes >= context.maxNodes || isRuleDrawUnchecked(meta)) return evaluateForTurn(meta);
	const inCheck = inCheckUnchecked(meta, meta.turn);
	const legal = generateLegalMovesUnchecked(meta);
	if (legal.length === 0) return inCheck ? -MATE_SCORE : 0;
	let alpha = alphaStart;
	if (!inCheck) {
		const standPat = evaluateForTurn(meta);
		if (standPat >= beta) return beta;
		if (standPat > alpha) alpha = standPat;
		if (remaining <= 0) return alpha;
	}
	const candidates = inCheck
		? legal
		: legal.filter((move) => move.kind === "capture" || move.kind === "en-passant" || move.promotion !== null);
	for (const move of orderSearchMoves(meta, candidates)) {
		const score = -quiescence(makeMoveUnchecked(meta, move, true), -beta, -alpha, context, remaining - 1);
		if (score >= beta) return beta;
		if (score > alpha) alpha = score;
		if (context.nodes >= context.maxNodes) break;
	}
	return alpha;
}

function negamax(
	meta: ChessMeta,
	depth: number,
	alphaStart: number,
	beta: number,
	context: SearchContext,
	ply: number,
): number {
	context.nodes += 1;
	if (context.nodes >= context.maxNodes) return evaluateForTurn(meta);
	if (isRuleDrawUnchecked(meta)) return 0;
	const legal = generateLegalMovesUnchecked(meta);
	if (legal.length === 0) return inCheckUnchecked(meta, meta.turn) ? -MATE_SCORE + ply : 0;
	if (depth <= 0) return quiescence(meta, alphaStart, beta, context, 3);
	let alpha = alphaStart;
	let best = -MATE_SCORE * 2;
	for (const move of orderSearchMoves(meta, legal)) {
		const score = -negamax(makeMoveUnchecked(meta, move, true), depth - 1, -beta, -alpha, context, ply + 1);
		if (score > best) best = score;
		if (score > alpha) alpha = score;
		if (alpha >= beta || context.nodes >= context.maxNodes) break;
	}
	return best;
}

function hashString(value: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function seededRandom(meta: ChessMeta): number {
	return nextSeed(meta.seed, hashString(chessPositionKeyUnchecked(meta))) / 0x1_0000_0000;
}

function normalizedRandom(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return ((value % 1) + 1) % 1;
}

function clampedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
	if (value === undefined || !Number.isFinite(value)) return fallback;
	return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function canonicalProvidedMoves(meta: ChessMeta, provided: readonly ChessMove[]): ChessMove[] {
	const legal = generateLegalMovesUnchecked(meta);
	if (provided.length === 0) return [];
	return legal.filter((candidate) => provided.some((move) => sameMoveIntent(candidate, move)));
}

/**
 * Chooses a legal move without wall-clock timing, making identical state/options reproducible.
 * Defaults: casual depth 1 / 1k nodes, sharp depth 2 / 15k, ruthless depth 3 / 100k.
 */
export function chooseChessBotMove(
	source: ChessMeta,
	player: ChessPlayerMark,
	legalMoves: readonly ChessMove[],
	difficulty: ChessDifficulty,
	options: ChessBotOptions = {},
): ChessMove | null {
	const meta = normalizeChessMeta(source);
	if (playerColor(player) !== meta.turn) return null;
	const status = statusUnchecked(meta);
	if (status.state === "checkmate" || status.state === "draw") return null;
	const candidates = canonicalProvidedMoves(meta, legalMoves);
	if (candidates.length === 0) return null;
	if (candidates.length === 1) return { ...candidates[0] };

	const defaultDepth = difficulty === "casual" ? 1 : difficulty === "sharp" ? 2 : 3;
	const defaultNodes = difficulty === "casual" ? 1_000 : difficulty === "sharp" ? 15_000 : 100_000;
	const depth = clampedInteger(options.maxDepth, defaultDepth, 1, 5);
	const context: SearchContext = {
		nodes: 0,
		maxNodes: clampedInteger(options.maxNodes, defaultNodes, 50, 250_000),
	};
	const scored = orderSearchMoves(meta, candidates).map((move) => ({
		move,
		score: -negamax(makeMoveUnchecked(meta, move, true), depth - 1, -MATE_SCORE * 2, MATE_SCORE * 2, context, 1),
	}));
	scored.sort((a, b) => b.score - a.score || compareMoves(a.move, b.move));

	const random = normalizedRandom(options.rng ? options.rng() : seededRandom(meta));
	let pool = [scored[0]];
	if (difficulty === "casual") {
		pool = scored.slice(0, Math.min(6, scored.length));
	} else if (difficulty === "sharp") {
		pool = scored.filter(({ score }) => score >= scored[0].score - 25).slice(0, 3);
	}
	return { ...pool[Math.min(pool.length - 1, Math.floor(random * pool.length))].move };
}
