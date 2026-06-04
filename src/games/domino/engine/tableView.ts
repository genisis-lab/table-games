import type { DominoMeta, DominoPlayerMark } from "./types";

export function maskDominoMetaForPlayer(meta: DominoMeta, player?: DominoPlayerMark): DominoMeta {
  const next = JSON.parse(JSON.stringify(meta)) as DominoMeta;
  next.deck = [];
  next.hands = {
    p1: player === "p1" ? next.hands.p1 : [],
    p2: player === "p2" ? next.hands.p2 : [],
    p3: player === "p3" ? next.hands.p3 : [],
    p4: player === "p4" ? next.hands.p4 : []
  };
  next.pipCounts = {
    p1: player === "p1" ? next.pipCounts.p1 : 0,
    p2: player === "p2" ? next.pipCounts.p2 : 0,
    p3: player === "p3" ? next.pipCounts.p3 : 0,
    p4: player === "p4" ? next.pipCounts.p4 : 0
  };
  return next;
}
