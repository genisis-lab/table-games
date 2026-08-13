import { describe, expect, it } from "vitest";
import {
  applyChessIntent,
  chessPerft,
  chessSquareToIndex,
  chooseChessBotMove,
  createChessMeta,
  createChessMetaFromFen,
  getChessLegalMoves,
  getChessStatus
} from "./engine";

const square = chessSquareToIndex;

describe("chess engine", () => {
  it("matches the canonical opening perft counts", () => {
    const start = createChessMeta();
    expect(chessPerft(start, 1)).toBe(20);
    expect(chessPerft(start, 2)).toBe(400);
    expect(chessPerft(start, 3)).toBe(8_902);
    expect(chessPerft(start, 4)).toBe(197_281);
  });

  it("matches the castling-rich Kiwipete perft fixture", () => {
    const position = createChessMetaFromFen(
      "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"
    );
    expect(chessPerft(position, 1)).toBe(48);
    expect(chessPerft(position, 2)).toBe(2_039);
  });

  it("enforces castling and moves the rook with the king", () => {
    const position = createChessMetaFromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const legal = getChessLegalMoves(position, "p1");
    expect(legal).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: square("e1"), to: square("g1"), kind: "castle-kingside" }),
      expect.objectContaining({ from: square("e1"), to: square("c1"), kind: "castle-queenside" })
    ]));
    const result = applyChessIntent(position, "p1", { from: square("e1"), to: square("g1") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.board[square("g1")]).toBe("K");
    expect(result.meta.board[square("f1")]).toBe("R");
    expect(result.meta.castling.whiteKingSide).toBe(false);
  });

  it("supports en passant only on the immediate legal square", () => {
    const position = createChessMetaFromFen("8/8/8/3pP3/8/8/8/4K2k w - d6 0 1");
    const result = applyChessIntent(position, "p1", { from: square("e5"), to: square("d6") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.board[square("d6")]).toBe("P");
    expect(result.meta.board[square("d5")]).toBe("");
  });

  it("requires an explicit choice among all four promotion pieces", () => {
    const position = createChessMetaFromFen("7k/P7/8/8/8/8/8/7K w - - 0 1");
    const promotions = getChessLegalMoves(position, "p1").filter(
      (move) => move.from === square("a7") && move.to === square("a8")
    );
    expect(promotions.map((move) => move.promotion).sort()).toEqual(["b", "n", "q", "r"]);
    expect(applyChessIntent(position, "p1", { from: square("a7"), to: square("a8") }).ok).toBe(false);
    const result = applyChessIntent(position, "p1", {
      from: square("a7"),
      to: square("a8"),
      promotion: "n"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meta.board[square("a8")]).toBe("N");
  });

  it("recognizes checkmate and authentic draw conditions", () => {
    let game = createChessMeta();
    for (const [player, from, to] of [
      ["p1", "f2", "f3"],
      ["p2", "e7", "e5"],
      ["p1", "g2", "g4"],
      ["p2", "d8", "h4"]
    ] as const) {
      const result = applyChessIntent(game, player, { from: square(from), to: square(to) });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      game = result.meta;
    }
    expect(getChessStatus(game)).toMatchObject({ state: "checkmate", reason: "checkmate", winner: "black" });

    expect(getChessStatus(createChessMetaFromFen("8/8/8/8/8/8/8/K6k w - - 0 1"))).toMatchObject({
      state: "draw",
      reason: "insufficient-material"
    });
    expect(getChessStatus(createChessMetaFromFen("8/8/8/8/8/8/R7/K6k w - - 100 51"))).toMatchObject({
      state: "draw",
      reason: "fifty-move"
    });
  });

  it("always returns a legal deterministic bot move", () => {
    const game = createChessMeta();
    const legal = getChessLegalMoves(game, "p1");
    const first = chooseChessBotMove(game, "p1", legal, "ruthless", { maxDepth: 2, maxNodes: 5_000 });
    const second = chooseChessBotMove(game, "p1", legal, "ruthless", { maxDepth: 2, maxNodes: 5_000 });
    expect(first).toEqual(second);
    expect(legal).toContainEqual(first);
  });
});
