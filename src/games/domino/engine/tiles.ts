import type { DominoTile } from "./types";

export const DOMINO_PLAYER_ORDER = ["p1", "p2", "p3", "p4"] as const;

export function makeDominoDeck(): DominoTile[] {
  const deck: DominoTile[] = [];
  for (let left = 0; left <= 6; left += 1) {
    for (let right = left; right <= 6; right += 1) {
      deck.push({ id: `${left}-${right}`, left, right });
    }
  }
  return deck;
}

export function shuffleDominoes(tiles: DominoTile[]): DominoTile[] {
  const shuffled = [...tiles];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function dominoPipSum(tiles: DominoTile[]): number {
  return tiles.reduce((sum, tile) => sum + tile.left + tile.right, 0);
}

export function tilePips(tile: DominoTile): number {
  return tile.left + tile.right;
}

export function flippedTile(tile: DominoTile): DominoTile {
  return { ...tile, left: tile.right, right: tile.left };
}

export function hasPip(tile: DominoTile, pip: number): boolean {
  return tile.left === pip || tile.right === pip;
}

export function otherTileEnd(tile: DominoTile, pip: number): number {
  return tile.left === pip ? tile.right : tile.left;
}
