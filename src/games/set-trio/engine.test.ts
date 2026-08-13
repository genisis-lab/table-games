import { describe, expect, it } from "vitest";
import {
  applySetTrioIntent,
  chooseSetTrioBotMove,
  createSetTrioCard,
  createSetTrioDeck,
  createSetTrioMeta,
  findSetTrioSets,
  getSetTrioLegalMoves,
  isSetTrioSet
} from "./engine";

describe("Set Trio engine", () => {
  it("builds the complete unique 81-card feature deck", () => {
    const deck = createSetTrioDeck();
    expect(deck).toHaveLength(81);
    expect(new Set(deck.map((card) => card.id)).size).toBe(81);
  });

  it("uses the all-same-or-all-different predicate for every feature", () => {
    const a = createSetTrioCard(0, 0, 0, 0);
    const b = createSetTrioCard(1, 1, 1, 1);
    const c = createSetTrioCard(2, 2, 2, 2);
    expect(isSetTrioSet(a, b, c)).toBe(true);
    expect(isSetTrioSet(a, b, createSetTrioCard(2, 2, 1, 2))).toBe(false);
  });

  it("creates deterministic seeded tables with at least one valid set", () => {
    const first = createSetTrioMeta("classic", 42);
    const second = createSetTrioMeta("classic", 42);
    expect(first).toEqual(second);
    expect(first.board.length).toBeGreaterThanOrEqual(12);
    expect(first.setsAvailable).toBeGreaterThan(0);
    expect(first.board.length + first.deck.length).toBe(81);
  });

  it("atomically scores a valid card-id claim and deals replacements", () => {
    const game = createSetTrioMeta("classic", 7);
    const [move] = getSetTrioLegalMoves(game, "p1");
    const beforeIds = game.board.map((card) => card.id);
    const result = applySetTrioIntent(game, "p1", { cardIds: move.cardIds });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.scores.p1).toBe(1);
    expect(result.meta.revision).toBe(1);
    expect(result.meta.lastClaim).toMatchObject({ valid: true, cardIds: move.cardIds });
    expect(result.meta.board.map((card) => card.id)).not.toEqual(beforeIds);

    const stale = applySetTrioIntent(result.meta, "p2", { cardIds: move.cardIds });
    expect(stale).toMatchObject({ ok: false });
  });

  it("penalizes a well-formed invalid claim without changing the table", () => {
    const game = createSetTrioMeta("classic", 99);
    let invalid: [number, number, number] | null = null;
    for (let a = 0; a < game.board.length && !invalid; a += 1) {
      for (let b = a + 1; b < game.board.length && !invalid; b += 1) {
        for (let c = b + 1; c < game.board.length; c += 1) {
          if (!isSetTrioSet(game.board[a], game.board[b], game.board[c])) {
            invalid = [a, b, c];
            break;
          }
        }
      }
    }
    expect(invalid).not.toBeNull();
    const before = game.board.map((card) => card.id);
    const result = applySetTrioIntent(game, "p2", { indices: invalid! });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.scores.p2).toBe(-1);
    expect(result.meta.invalidClaims.p2).toBe(1);
    expect(result.meta.board.map((card) => card.id)).toEqual(before);
    expect(result.meta.cooldowns.p2?.durationMs).toBe(1_500);
  });

  it("keeps legal moves real and lets bots choose only a visible set", () => {
    const game = createSetTrioMeta("classic", 1_234);
    const legal = findSetTrioSets(game.board);
    for (const difficulty of ["casual", "sharp", "ruthless"] as const) {
      const move = chooseSetTrioBotMove(game, "p2", legal, difficulty);
      expect(legal).toContainEqual(move);
      const [a, b, c] = move.indices.map((index) => game.board[index]);
      expect(isSetTrioSet(a, b, c)).toBe(true);
    }
  });
});
