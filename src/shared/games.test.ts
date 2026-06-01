import { describe, expect, it } from "vitest";
import {
  applyGameMove,
  chooseBotMove,
  createGameState,
  getGameDefinition,
  type Cell,
  type GameMove,
  type GameState
} from "./games";

function play(
  state: GameState,
  player: "p1" | "p2",
  move: GameMove
): GameState {
  const result = applyGameMove(state, player, move);
  expect(result.ok).toBe(true);
  return result.state;
}

describe("Four in a Row", () => {
  it("uses a 7 by 6 vertical board and drops pieces to the lowest empty slot", () => {
    const state = createGameState("four-in-a-row");
    expect(getGameDefinition("four-in-a-row").columns).toBe(7);
    expect(getGameDefinition("four-in-a-row").rows).toBe(6);

    const afterP1 = play(state, "p1", { column: 3 });
    const afterP2 = play(afterP1, "p2", { column: 3 });

    expect(afterP1.board[5][3]).toBe("p1");
    expect(afterP2.board[4][3]).toBe("p2");
    expect(afterP2.turn).toBe("p1");
  });

  it("rejects moves from the wrong player and full columns", () => {
    let state = createGameState("four-in-a-row");
    expect(applyGameMove(state, "p2", { column: 0 })).toMatchObject({
      ok: false,
      reason: "It is not your turn."
    });

    for (let i = 0; i < 6; i += 1) {
      state = play(state, i % 2 === 0 ? "p1" : "p2", { column: 0 });
    }

    expect(applyGameMove(state, "p1", { column: 0 })).toMatchObject({
      ok: false,
      reason: "That column is full."
    });
  });

  it("detects a horizontal four-piece win", () => {
    let state = createGameState("four-in-a-row");
    state = play(state, "p1", { column: 0 });
    state = play(state, "p2", { column: 0 });
    state = play(state, "p1", { column: 1 });
    state = play(state, "p2", { column: 1 });
    state = play(state, "p1", { column: 2 });
    state = play(state, "p2", { column: 2 });
    state = play(state, "p1", { column: 3 });

    expect(state.winner).toBe("p1");
    expect(state.winningLine).toHaveLength(4);
  });
});

describe("Tic Tac Toe", () => {
  it("detects a diagonal X or O win on a 3 by 3 board", () => {
    let state = createGameState("tic-tac-toe");
    state = play(state, "p1", { row: 0, column: 0 });
    state = play(state, "p2", { row: 0, column: 1 });
    state = play(state, "p1", { row: 1, column: 1 });
    state = play(state, "p2", { row: 0, column: 2 });
    state = play(state, "p1", { row: 2, column: 2 });

    expect(state.winner).toBe("p1");
    expect(state.winningLine).toEqual([
      { row: 0, column: 0 },
      { row: 1, column: 1 },
      { row: 2, column: 2 }
    ]);
  });

  it("marks a full board with no winner as a draw", () => {
    let state = createGameState("tic-tac-toe");
    const moves: Array<["p1" | "p2", GameMove]> = [
      ["p1", { row: 0, column: 0 }],
      ["p2", { row: 0, column: 1 }],
      ["p1", { row: 0, column: 2 }],
      ["p2", { row: 1, column: 1 }],
      ["p1", { row: 1, column: 0 }],
      ["p2", { row: 1, column: 2 }],
      ["p1", { row: 2, column: 1 }],
      ["p2", { row: 2, column: 0 }],
      ["p1", { row: 2, column: 2 }]
    ];

    for (const [player, move] of moves) {
      state = play(state, player, move);
    }

    expect(state.winner).toBe("draw");
  });
});

describe("Gomoku", () => {
  it("uses a 15 by 15 board and detects five stones in a row", () => {
    let state = createGameState("gomoku");
    expect(getGameDefinition("gomoku").columns).toBe(15);
    expect(getGameDefinition("gomoku").rows).toBe(15);

    state = play(state, "p1", { row: 7, column: 3 });
    state = play(state, "p2", { row: 8, column: 3 });
    state = play(state, "p1", { row: 7, column: 4 });
    state = play(state, "p2", { row: 8, column: 4 });
    state = play(state, "p1", { row: 7, column: 5 });
    state = play(state, "p2", { row: 8, column: 5 });
    state = play(state, "p1", { row: 7, column: 6 });
    state = play(state, "p2", { row: 8, column: 6 });
    state = play(state, "p1", { row: 7, column: 7 });

    expect(state.winner).toBe("p1");
    expect(state.winningLine).toHaveLength(5);
  });

  it("rejects occupied intersections", () => {
    const state = play(createGameState("gomoku"), "p1", { row: 4, column: 4 });

    expect(applyGameMove(state, "p2", { row: 4, column: 4 })).toMatchObject({
      ok: false,
      reason: "That spot is already taken."
    });
  });
});

describe("New game engines", () => {
  it("tracks active boards and local wins in Ultimate Tic Tac Toe", () => {
    let state = createGameState("ultimate-tic-tac-toe");
    state = play(state, "p1", { row: 8, column: 8 });

    expect(state.meta?.ultimate?.activeBoard).toBe(8);

    state = play(state, "p2", { row: 6, column: 6 });
    state = play(state, "p1", { row: 2, column: 2 });
    state = play(state, "p2", { row: 6, column: 7 });
    state = play(state, "p1", { row: 2, column: 5 });
    state = play(state, "p2", { row: 6, column: 8 });

    expect(state.meta?.ultimate?.localWinners[8]).toBe("p2");
  });

  it("scores completed boxes in Dots and Boxes without changing turns", () => {
    let state = createGameState("dots-and-boxes");
    state = play(state, "p1", { edge: "h", row: 0, column: 0 });
    state = play(state, "p2", { edge: "v", row: 0, column: 0 });
    state = play(state, "p1", { edge: "h", row: 1, column: 0 });
    state = play(state, "p2", { edge: "v", row: 0, column: 1 });

    expect(state.board[0][0]).toBe("p2");
    expect(state.turn).toBe("p2");
    expect(state.meta?.dots?.scores.p2).toBe(1);
  });

  it("flips captured discs in Reversi", () => {
    const state = play(createGameState("reversi"), "p1", { row: 2, column: 3 });

    expect(state.board[2][3]).toBe("p1");
    expect(state.board[3][3]).toBe("p1");
  });

  it("moves and promotes Checkers pieces", () => {
    let state = createGameState("checkers");
    state.board = Array.from({ length: 8 }, () => Array.from<Cell>({ length: 8 }).fill(null));
    state.board[1][2] = "p1";

    state = play(state, "p1", { row: 1, column: 2, toRow: 0, toColumn: 3 });

    expect(state.board[0][3]).toBe("p1");
    expect(state.meta?.checkers?.kings).toContain("0,3");
  });

  it("records hits in Battleship", () => {
    const state = createGameState("battleship");
    const firstShip = state.meta?.battleship?.botShips[0];
    expect(firstShip).toBeTruthy();

    const next = play(state, "p1", { row: firstShip!.row, column: firstShip!.column });
    expect(next.meta?.battleship?.humanShots[`${firstShip!.row},${firstShip!.column}`]).toBe("hit");
  });

  it("sows stones and updates stores in Mancala", () => {
    const state = play(createGameState("mancala"), "p1", { column: 2 });

    expect(state.meta?.mancala?.pits.p1[2]).toBe(0);
    expect(state.meta?.mancala?.stores.p1).toBe(1);
  });

  it("detects a connected Hex path", () => {
    let state = createGameState("hex");
    state = play(state, "p1", { row: 0, column: 0 });
    state = play(state, "p2", { row: 10, column: 0 });
    state = play(state, "p1", { row: 0, column: 1 });
    state = play(state, "p2", { row: 10, column: 1 });
    state = play(state, "p1", { row: 0, column: 2 });
    state = play(state, "p2", { row: 10, column: 2 });
    state = play(state, "p1", { row: 0, column: 3 });
    state = play(state, "p2", { row: 10, column: 3 });
    state = play(state, "p1", { row: 0, column: 4 });
    state = play(state, "p2", { row: 10, column: 4 });
    state = play(state, "p1", { row: 0, column: 5 });
    state = play(state, "p2", { row: 10, column: 5 });
    state = play(state, "p1", { row: 0, column: 6 });
    state = play(state, "p2", { row: 10, column: 6 });
    state = play(state, "p1", { row: 0, column: 7 });
    state = play(state, "p2", { row: 10, column: 7 });
    state = play(state, "p1", { row: 0, column: 8 });
    state = play(state, "p2", { row: 10, column: 8 });
    state = play(state, "p1", { row: 0, column: 9 });
    state = play(state, "p2", { row: 10, column: 9 });
    state = play(state, "p1", { row: 0, column: 10 });

    expect(state.winner).toBe("p1");
  });

  it("places Nine Men's Morris pieces and removes an opponent after a mill", () => {
    let state = createGameState("nine-mens-morris");
    state = play(state, "p1", { row: 0, column: 0 });
    state = play(state, "p2", { row: 1, column: 1 });
    state = play(state, "p1", { row: 0, column: 3 });
    state = play(state, "p2", { row: 1, column: 3 });
    state = play(state, "p1", { row: 0, column: 6 });

    expect(state.meta?.morris?.placed.p1).toBe(3);
    expect(state.board.flat().filter((cell) => cell === "p2")).toHaveLength(1);
  });
});

describe("Bot move selection", () => {
  it("wins Tic Tac Toe immediately when a winning move exists", () => {
    let state = createGameState("tic-tac-toe");
    state = play(state, "p1", { row: 0, column: 0 });
    state = play(state, "p2", { row: 1, column: 0 });
    state = play(state, "p1", { row: 0, column: 1 });
    state = play(state, "p2", { row: 1, column: 1 });

    expect(chooseBotMove(state, "p1", "ruthless")).toEqual({ row: 0, column: 2 });
  });

  it("blocks an immediate Four in a Row win", () => {
    let state = createGameState("four-in-a-row");
    state = play(state, "p1", { column: 0 });
    state = play(state, "p2", { column: 4 });
    state = play(state, "p1", { column: 1 });
    state = play(state, "p2", { column: 4 });
    state = play(state, "p1", { column: 2 });

    expect(chooseBotMove(state, "p2", "ruthless")).toEqual({ column: 3 });
  });

  it("extends a Gomoku four-stone line into a win", () => {
    let state = createGameState("gomoku");
    state = play(state, "p1", { row: 7, column: 3 });
    state = play(state, "p2", { row: 8, column: 3 });
    state = play(state, "p1", { row: 7, column: 4 });
    state = play(state, "p2", { row: 8, column: 4 });
    state = play(state, "p1", { row: 7, column: 5 });
    state = play(state, "p2", { row: 8, column: 5 });
    state = play(state, "p1", { row: 7, column: 6 });
    state = play(state, "p2", { row: 8, column: 6 });

    expect(chooseBotMove(state, "p1", "ruthless")).toEqual({ row: 7, column: 7 });
  });
});
