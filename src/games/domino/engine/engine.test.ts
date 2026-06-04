import { describe, expect, it } from "vitest";
import {
  applyDominoIntent,
  chooseDominoBotMove,
  createDominoMeta,
  getDominoLegalMoves,
  makeDominoDeck,
  maskDominoMetaForPlayer,
  normalizeDominoMeta,
  type DominoMeta,
  type DominoTile
} from ".";

function tile(left: number, right: number): DominoTile {
  return { id: `${left}-${right}`, left, right };
}

function testMeta(overrides: Partial<DominoMeta> = {}): DominoMeta {
  return normalizeDominoMeta({
    deck: [],
    hands: {
      p1: [],
      p2: [],
      p3: [],
      p4: []
    },
    handCounts: { p1: 0, p2: 0, p3: 0, p4: 0 },
    chain: [],
    openLeft: null,
    openRight: null,
    scores: { p1: 0, p2: 0, p3: 0, p4: 0 },
    pipCounts: { p1: 0, p2: 0, p3: 0, p4: 0 },
    teamScores: { northSouth: 0, eastWest: 0 },
    passed: [],
    passedNumbers: { p1: [], p2: [], p3: [], p4: [] },
    playerOrder: ["p1", "p2", "p3", "p4"],
    round: 1,
    targetScore: 100,
    gameMode: "partnership",
    drawMode: "block",
    log: [],
    ...overrides
  });
}

describe("Domino engine", () => {
  it("creates one double-six deck and deals four seven-tile hands", () => {
    const deck = makeDominoDeck();
    const meta = createDominoMeta();

    expect(deck).toHaveLength(28);
    expect(new Set(deck.map((domino) => domino.id))).toHaveLength(28);
    expect(meta.deck).toHaveLength(0);
    expect(meta.handCounts).toEqual({ p1: 7, p2: 7, p3: 7, p4: 7 });
    expect(meta.gameMode).toBe("partnership");
    expect(meta.targetScore).toBe(100);
  });

  it("detects legal left and right placements", () => {
    const meta = testMeta({
      hands: {
        p1: [tile(2, 4), tile(6, 1), tile(0, 0)],
        p2: [],
        p3: [],
        p4: []
      },
      chain: [{ ...tile(4, 6), owner: "p2", roundIndex: 0 }],
      openLeft: 4,
      openRight: 6
    });

    expect(getDominoLegalMoves(meta, "p1").map((move) => [move.column, move.edge])).toEqual([
      [0, "h"],
      [1, "v"]
    ]);
  });

  it("prevents passing when a matching tile is available", () => {
    const meta = testMeta({
      hands: {
        p1: [tile(2, 4), tile(0, 0)],
        p2: [],
        p3: [],
        p4: []
      },
      chain: [{ ...tile(4, 6), owner: "p2", roundIndex: 0 }],
      openLeft: 4,
      openRight: 6
    });

    expect(applyDominoIntent(meta, "p1", { column: -1 })).toMatchObject({
      ok: false,
      reason: "You have a playable domino."
    });
  });

  it("auto-resolves a wrong-end tap when the tile has one legal side", () => {
    const meta = testMeta({
      hands: {
        p1: [tile(2, 4), tile(0, 0)],
        p2: [],
        p3: [],
        p4: []
      },
      chain: [{ ...tile(4, 6), owner: "p2", roundIndex: 0 }],
      openLeft: 4,
      openRight: 6
    });

    const result = applyDominoIntent(meta, "p1", { column: 0, edge: "v" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point).toEqual({ row: 0, column: 0 });
    expect(result.meta.openLeft).toBe(2);
    expect(result.meta.openRight).toBe(6);
  });

  it("scores a partnership round and deals the next round until match target is reached", () => {
    const meta = testMeta({
      hands: {
        p1: [tile(6, 6)],
        p2: [tile(0, 5)],
        p3: [tile(0, 0)],
        p4: [tile(1, 2)]
      },
      chain: [{ ...tile(2, 6), owner: "p4", roundIndex: 0 }],
      openLeft: 2,
      openRight: 6
    });

    const result = applyDominoIntent(meta, "p1", { column: 0, edge: "v" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.winner).toBeNull();
    expect(result.meta.lastRound).toMatchObject({ winner: "p1", points: 8, blocked: false });
    expect(result.meta.teamScores.northSouth).toBe(8);
    expect(result.meta.handCounts).toEqual({ p1: 7, p2: 7, p3: 7, p4: 7 });
  });

  it("detects blocked rounds and scores the lowest remaining hand", () => {
    const meta = testMeta({
      gameMode: "free-for-all",
      hands: {
        p1: [tile(5, 6)],
        p2: [tile(0, 0)],
        p3: [tile(0, 1)],
        p4: [tile(0, 4)]
      },
      chain: [{ ...tile(2, 3), owner: "p4", roundIndex: 0 }],
      openLeft: 2,
      openRight: 3,
      passed: ["p2", "p3", "p4"]
    });

    const result = applyDominoIntent(meta, "p1", { column: -1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.lastRound).toMatchObject({ winner: "p2", points: 16, blocked: true });
    expect(result.meta.scores.p2).toBe(16);
  });

  it("uses hard bot pressure to block the next player from going out", () => {
    const meta = testMeta({
      hands: {
        p1: [],
        p2: [tile(6, 1), tile(5, 0)],
        p3: [tile(6, 6)],
        p4: []
      },
      handCounts: { p1: 0, p2: 2, p3: 1, p4: 0 },
      chain: [{ ...tile(5, 6), owner: "p1", roundIndex: 0 }],
      openLeft: 5,
      openRight: 6
    });

    const move = chooseDominoBotMove(meta, "p2", [
      { column: 0, edge: "v" },
      { column: 1, edge: "h" }
    ], "ruthless");

    expect(move).toEqual({ column: 0, edge: "v" });
  });

  it("masks hidden hands and hidden pip counts for non-owners", () => {
    const meta = createDominoMeta();
    const masked = maskDominoMetaForPlayer(meta, "p1");

    expect(masked.hands.p1).toHaveLength(7);
    expect(masked.hands.p2).toHaveLength(0);
    expect(masked.handCounts.p2).toBe(7);
    expect(masked.pipCounts.p2).toBe(0);
    expect(masked.deck).toHaveLength(0);
  });
});
