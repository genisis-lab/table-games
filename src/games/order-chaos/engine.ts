// src/games/order-chaos/engine.ts
//
// Self-contained Order and Chaos engine for Table Sparks.
//
// Mirrors src/games/cup-pong/engine.ts. p1 plays "Order" and wins by forming a
// line of five identical marks (horizontal, vertical, or diagonal) anywhere on
// the 6x6 board. p2 plays "Chaos" and wins if the board fills with no such
// line. On every turn the player to move places EITHER an X or an O on any
// empty cell; a completed line of five always wins the game for Order, no
// matter who placed the final mark.

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
	lastMove: { index: number; piece: OrderChaosPiece; player: OrderChaosPlayerMark } | null