import { dominoPipSum } from "./tiles";
import type {
  DominoMeta,
  DominoPlayerMark,
  DominoRoundSummary,
  DominoTeamId
} from "./types";

export function teamForPlayer(player: DominoPlayerMark): DominoTeamId {
  return player === "p1" || player === "p3" ? "northSouth" : "eastWest";
}

export function partnerFor(player: DominoPlayerMark): DominoPlayerMark {
  if (player === "p1") return "p3";
  if (player === "p3") return "p1";
  if (player === "p2") return "p4";
  return "p2";
}

export function syncDominoCounts(meta: DominoMeta): DominoMeta {
  meta.handCounts = {
    p1: meta.hands.p1.length,
    p2: meta.hands.p2.length,
    p3: meta.hands.p3.length,
    p4: meta.hands.p4.length
  };
  meta.pipCounts = {
    p1: dominoPipSum(meta.hands.p1),
    p2: dominoPipSum(meta.hands.p2),
    p3: dominoPipSum(meta.hands.p3),
    p4: dominoPipSum(meta.hands.p4)
  };
  meta.teamScores ??= { northSouth: 0, eastWest: 0 };
  meta.scores = meta.gameMode === "partnership"
    ? {
        p1: meta.teamScores.northSouth,
        p2: meta.teamScores.eastWest,
        p3: meta.teamScores.northSouth,
        p4: meta.teamScores.eastWest
      }
    : {
        p1: meta.scores?.p1 ?? 0,
        p2: meta.scores?.p2 ?? 0,
        p3: meta.scores?.p3 ?? 0,
        p4: meta.scores?.p4 ?? 0
      };
  return meta;
}

export function scoreRound(
  meta: DominoMeta,
  winner: DominoPlayerMark | "draw",
  blocked: boolean,
  reason: string
): { summary: DominoRoundSummary; matchWinner: DominoPlayerMark | "draw" | null } {
  syncDominoCounts(meta);
  const remainingPips = { ...meta.pipCounts };
  if (winner === "draw") {
    const summary = {
      round: meta.round,
      winner,
      points: 0,
      blocked,
      remainingPips,
      reason
    } satisfies DominoRoundSummary;
    meta.lastRound = summary;
    meta.roundWinner = "draw";
    meta.lastScoreDelta = 0;
    return { summary, matchWinner: null };
  }

  const winningTeam = teamForPlayer(winner);
  const points = meta.gameMode === "partnership"
    ? meta.playerOrder
        .filter((player) => teamForPlayer(player) !== winningTeam)
        .reduce((sum, player) => sum + meta.pipCounts[player], 0)
    : meta.playerOrder
        .filter((player) => player !== winner)
        .reduce((sum, player) => sum + meta.pipCounts[player], 0);

  if (meta.gameMode === "partnership") {
    meta.teamScores[winningTeam] += points;
  } else {
    meta.scores[winner] += points;
  }

  syncDominoCounts(meta);
  const summary = {
    round: meta.round,
    winner,
    winningTeam,
    points,
    blocked,
    remainingPips,
    reason
  } satisfies DominoRoundSummary;
  meta.lastRound = summary;
  meta.roundWinner = winner;
  meta.winningTeam = meta.gameMode === "partnership" ? winningTeam : undefined;
  meta.lastScoreDelta = points;

  const matchWinner = matchWinnerFor(meta);
  return { summary, matchWinner };
}

export function blockedRoundWinner(meta: DominoMeta): DominoPlayerMark | "draw" {
  syncDominoCounts(meta);
  if (meta.gameMode === "partnership") {
    const northSouth = meta.pipCounts.p1 + meta.pipCounts.p3;
    const eastWest = meta.pipCounts.p2 + meta.pipCounts.p4;
    if (northSouth === eastWest) return "draw";
    return northSouth < eastWest
      ? lowestPipPlayer(meta, ["p1", "p3"])
      : lowestPipPlayer(meta, ["p2", "p4"]);
  }
  const ranked = [...meta.playerOrder].sort((a, b) => meta.pipCounts[a] - meta.pipCounts[b]);
  return meta.pipCounts[ranked[0]] === meta.pipCounts[ranked[1]] ? "draw" : ranked[0];
}

export function matchWinnerFor(meta: DominoMeta): DominoPlayerMark | "draw" | null {
  if (meta.gameMode === "partnership") {
    const northSouthWins = meta.teamScores.northSouth >= meta.targetScore;
    const eastWestWins = meta.teamScores.eastWest >= meta.targetScore;
    if (northSouthWins && eastWestWins) return "draw";
    if (northSouthWins) return "p1";
    if (eastWestWins) return "p2";
    return null;
  }
  const ranked = [...meta.playerOrder].sort((a, b) => meta.scores[b] - meta.scores[a]);
  if (meta.scores[ranked[0]] < meta.targetScore) return null;
  return meta.scores[ranked[0]] === meta.scores[ranked[1]] ? "draw" : ranked[0];
}

function lowestPipPlayer(meta: DominoMeta, players: DominoPlayerMark[]): DominoPlayerMark {
  return [...players].sort((a, b) => meta.pipCounts[a] - meta.pipCounts[b])[0];
}
