import { resultingEndsFor } from "./legalMoves";
import { partnerFor } from "./scoring";
import { hasPip, tilePips } from "./tiles";
import type {
  DominoDifficulty,
  DominoLegalMove,
  DominoMeta,
  DominoMove,
  DominoPlayerMark
} from "./types";

export function chooseDominoBotMove(
  meta: DominoMeta,
  player: DominoPlayerMark,
  legalMoves: DominoMove[],
  difficulty: DominoDifficulty
): DominoMove {
  const playable = legalMoves.filter((move) => move.column >= 0);
  if (playable.length === 0) return legalMoves[0] ?? { column: -1 };
  if (difficulty === "casual") return playable[0];

  const legal = playable
    .map((move) => toLegalMove(meta, player, move))
    .filter((move): move is DominoLegalMove => Boolean(move));

  if (legal.length === 0) return playable[0];
  const scored = legal
    .map((move) => ({
      move,
      score: difficulty === "sharp"
        ? mediumDominoScore(meta, player, move)
        : hardDominoScore(meta, player, move)
    }))
    .sort((a, b) => b.score - a.score);

  return { column: scored[0].move.column, edge: scored[0].move.edge };
}

export function estimateOpponentWeakness(meta: DominoMeta, player: DominoPlayerMark, pip: number): number {
  const opponents = meta.playerOrder.filter((candidate) =>
    candidate !== player && (meta.gameMode === "free-for-all" || candidate !== partnerFor(player))
  );
  return opponents.reduce((score, opponent) => {
    const passedPenalty = meta.passedNumbers[opponent]?.includes(pip) ? 28 : 0;
    const visibleHandRisk = meta.hands[opponent]?.filter((tile) => hasPip(tile, pip)).length * -7;
    const lowHandPressure = meta.handCounts[opponent] <= 2 ? passedPenalty * 1.35 : passedPenalty;
    return score + lowHandPressure + visibleHandRisk;
  }, 0);
}

function mediumDominoScore(meta: DominoMeta, player: DominoPlayerMark, move: DominoLegalMove): number {
  const remainingHand = meta.hands[player].filter((_, index) => index !== move.column);
  const followCount = remainingHand.filter((tile) =>
    hasPip(tile, move.resultingEnds[0]) || hasPip(tile, move.resultingEnds[1])
  ).length;
  const nextPlayer = nextPlayerAfter(meta, player);
  const blocksNext = move.resultingEnds.every((pip) => !meta.hands[nextPlayer].some((tile) => hasPip(tile, pip)));
  return (
    tilePips(move.tile) * 8 +
    (move.tile.left === move.tile.right ? 22 : 0) +
    followCount * 12 +
    (blocksNext ? 26 : 0) -
    remainingHand.length * 2
  );
}

function hardDominoScore(meta: DominoMeta, player: DominoPlayerMark, move: DominoLegalMove): number {
  const remainingHand = meta.hands[player].filter((_, index) => index !== move.column);
  if (remainingHand.length === 0) return 1_000_000 + tilePips(move.tile);

  const [leftEnd, rightEnd] = resultingEndsFor(meta, move.orientedTile, move.side);
  const nextPlayer = nextPlayerAfter(meta, player);
  const partner = partnerFor(player);
  const ownFollowCount = remainingHand.filter((tile) => hasPip(tile, leftEnd) || hasPip(tile, rightEnd)).length;
  const partnerFollowCount = meta.gameMode === "partnership"
    ? meta.hands[partner].filter((tile) => hasPip(tile, leftEnd) || hasPip(tile, rightEnd)).length
    : 0;
  const nextPlayerCanPlay = meta.hands[nextPlayer].some((tile) => hasPip(tile, leftEnd) || hasPip(tile, rightEnd));
  const nextPlayerDanger = meta.handCounts[nextPlayer] <= 2 ? 95 : meta.handCounts[nextPlayer] <= 3 ? 42 : 0;
  const weaknessScore =
    estimateOpponentWeakness(meta, player, leftEnd) +
    estimateOpponentWeakness(meta, player, rightEnd);
  const handShapeScore = pipDiversityScore(remainingHand, leftEnd, rightEnd);
  const teamScore = meta.gameMode === "partnership" ? partnerFollowCount * 18 : 0;

  return (
    tilePips(move.tile) * 10 +
    (move.tile.left === move.tile.right ? 30 : 0) +
    ownFollowCount * 18 +
    handShapeScore +
    teamScore +
    weaknessScore +
    (nextPlayerCanPlay ? -nextPlayerDanger : nextPlayerDanger) -
    remainingHand.length * 4
  );
}

function toLegalMove(meta: DominoMeta, player: DominoPlayerMark, move: DominoMove): DominoLegalMove | null {
  const tile = meta.hands[player][move.column];
  if (!tile) return null;
  const side = move.edge === "h" ? "left" : "right";
  if (meta.chain.length === 0) {
    return {
      column: move.column,
      edge: move.edge ?? "v",
      side: "right",
      tile,
      orientedTile: tile,
      resultingEnds: [tile.left, tile.right]
    };
  }
  const open = side === "left" ? meta.openLeft : meta.openRight;
  if (open === null) return null;
  const orientedTile = side === "left"
    ? tile.right === open
      ? tile
      : tile.left === open
        ? { ...tile, left: tile.right, right: tile.left }
        : null
    : tile.left === open
      ? tile
      : tile.right === open
        ? { ...tile, left: tile.right, right: tile.left }
        : null;
  if (!orientedTile) return null;
  return {
    column: move.column,
    edge: side === "left" ? "h" : "v",
    side,
    tile,
    orientedTile,
    resultingEnds: resultingEndsFor(meta, orientedTile, side)
  };
}

function nextPlayerAfter(meta: DominoMeta, player: DominoPlayerMark): DominoPlayerMark {
  const current = meta.playerOrder.indexOf(player);
  return meta.playerOrder[(current + 1) % meta.playerOrder.length] ?? "p1";
}

function pipDiversityScore(hand: Array<{ left: number; right: number }>, leftEnd: number, rightEnd: number): number {
  const counts = new Map<number, number>();
  for (const tile of hand) {
    counts.set(tile.left, (counts.get(tile.left) ?? 0) + 1);
    counts.set(tile.right, (counts.get(tile.right) ?? 0) + 1);
  }
  return (counts.get(leftEnd) ?? 0) * 9 + (counts.get(rightEnd) ?? 0) * 9 + counts.size * 2;
}
