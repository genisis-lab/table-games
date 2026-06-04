import { flippedTile } from "./tiles";
import type {
  DominoLegalMove,
  DominoMeta,
  DominoMove,
  DominoPlayerMark,
  DominoSide,
  DominoTile
} from "./types";

export function getDominoLegalMoves(meta: DominoMeta, player: DominoPlayerMark): DominoLegalMove[] {
  if (!meta.playerOrder.includes(player)) return [];
  const moves: DominoLegalMove[] = [];

  meta.hands[player].forEach((tile, column) => {
    const sides = legalSidesForTile(meta, tile);
    sides.forEach((side) => {
      const orientedTile = orientDomino(tile, side, meta);
      if (!orientedTile) return;
      moves.push({
        column,
        edge: side === "left" ? "h" : "v",
        side,
        tile,
        orientedTile,
        resultingEnds: resultingEndsFor(meta, orientedTile, side)
      });
    });
  });

  return moves;
}

export function hasAnyDominoMove(meta: DominoMeta, player: DominoPlayerMark): boolean {
  return getDominoLegalMoves(meta, player).length > 0;
}

export function orientDomino(tile: DominoTile, side: DominoSide, meta: DominoMeta): DominoTile | null {
  if (meta.chain.length === 0) return tile;

  if (side === "left") {
    if (tile.right === meta.openLeft) return tile;
    if (tile.left === meta.openLeft) return flippedTile(tile);
    return null;
  }

  if (tile.left === meta.openRight) return tile;
  if (tile.right === meta.openRight) return flippedTile(tile);
  return null;
}

export function sideFromMove(move: DominoMove): DominoSide {
  return move.edge === "h" ? "left" : "right";
}

export function isSameMove(a: DominoMove, b: DominoMove): boolean {
  return a.column === b.column && sideFromMove(a) === sideFromMove(b);
}

export function legalSidesForTile(meta: DominoMeta, tile: DominoTile): DominoSide[] {
  if (meta.chain.length === 0) return ["right"];
  const sides: DominoSide[] = [];
  if (tile.left === meta.openLeft || tile.right === meta.openLeft) sides.push("left");
  if (tile.left === meta.openRight || tile.right === meta.openRight) sides.push("right");
  return sides;
}

export function resultingEndsFor(meta: DominoMeta, tile: DominoTile, side: DominoSide): [number, number] {
  if (meta.chain.length === 0) return [tile.left, tile.right];
  if (side === "left") return [tile.left, meta.openRight ?? tile.right];
  return [meta.openLeft ?? tile.left, tile.right];
}
