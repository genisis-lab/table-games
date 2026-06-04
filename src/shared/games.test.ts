import { describe, expect, it } from "vitest";
import {
  applyGameMove,
  chooseBotMove,
  createGameState,
  getBoardVariantOptions,
  getGameDefinition,
  isSoloGame,
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

  it("supports larger board variants with longer connection goals", () => {
    let state = createGameState("tic-tac-toe", "wide");
    expect(state.board).toHaveLength(5);
    expect(state.board[0]).toHaveLength(5);

    state = play(state, "p1", { row: 0, column: 0 });
    state = play(state, "p2", { row: 1, column: 0 });
    state = play(state, "p1", { row: 0, column: 1 });
    state = play(state, "p2", { row: 1, column: 1 });
    state = play(state, "p1", { row: 0, column: 2 });
    state = play(state, "p2", { row: 1, column: 2 });
    state = play(state, "p1", { row: 0, column: 3 });

    expect(state.winner).toBe("p1");
    expect(state.winningLine).toHaveLength(4);
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

  it("can create a larger Ultimate Tic Tac Toe variant", () => {
    const state = createGameState("ultimate-tic-tac-toe", "wide");

    expect(state.board).toHaveLength(16);
    expect(state.meta?.ultimate?.localWinners).toHaveLength(16);
    expect(getBoardVariantOptions("ultimate-tic-tac-toe").map((option) => option.label)).toEqual(["3x3", "4x4"]);
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

  it("chooses a safe Dots and Boxes edge instead of handing over a nearly finished square", () => {
    const state = createGameState("dots-and-boxes");
    state.meta!.dots!.hEdges[1][1] = true;
    state.meta!.dots!.vEdges[1][1] = true;

    const move = chooseBotMove(state, "p1", "casual");

    expect(move).toBeTruthy();
    expect([
      { edge: "h", row: 2, column: 1 },
      { edge: "v", row: 1, column: 2 }
    ]).not.toContainEqual(move);
  });

  it("supports larger Dots and Boxes variants", () => {
    const state = createGameState("dots-and-boxes", "party");

    expect(state.board).toHaveLength(6);
    expect(state.meta?.dots?.hEdges).toHaveLength(7);
    expect(state.meta?.dots?.vEdges[0]).toHaveLength(7);
  });

  it("offers a compact 3x3 Dots and Boxes mode", () => {
    const options = getBoardVariantOptions("dots-and-boxes").map((option) => option.label);
    const state = createGameState("dots-and-boxes", "mini");

    expect(options).toContain("3x3");
    expect(state.board).toHaveLength(3);
    expect(state.board[0]).toHaveLength(3);
    expect(state.meta?.dots?.hEdges).toHaveLength(4);
    expect(state.meta?.dots?.vEdges[0]).toHaveLength(4);
  });

  it("does not end Dots and Boxes when the first box is scored", () => {
    let state = createGameState("dots-and-boxes", "mini");
    state = play(state, "p1", { edge: "h", row: 0, column: 0 });
    state = play(state, "p2", { edge: "v", row: 0, column: 0 });
    state = play(state, "p1", { edge: "h", row: 1, column: 0 });
    state = play(state, "p2", { edge: "v", row: 0, column: 1 });

    expect(state.board[0][0]).toBe("p2");
    expect(state.meta?.dots?.scores.p2).toBe(1);
    expect(state.turn).toBe("p2");
    expect(state.winner).toBeNull();
  });

  it("decides Dots and Boxes by the final box count after every line is drawn", () => {
    const state = createGameState("dots-and-boxes", "mini");
    const dots = state.meta!.dots!;
    dots.hEdges = dots.hEdges.map((row) => row.map(() => true));
    dots.vEdges = dots.vEdges.map((row) => row.map(() => true));
    dots.hEdges[0][0] = false;
    state.board = [
      [null, "p1", "p2"],
      ["p1", "p2", "p1"],
      ["p2", "p1", "p2"]
    ];
    dots.scores = { p1: 4, p2: 4 };
    state.turn = "p1";

    const result = applyGameMove(state, "p1", { edge: "h", row: 0, column: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.meta?.dots?.scores).toEqual({ p1: 5, p2: 4 });
    expect(result.state.winner).toBe("p1");
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

  it("groups Battleship fleets into named ships for sunk-ship reveals", () => {
    const state = createGameState("battleship");
    const fleet = state.meta?.battleship?.botFleet;

    expect(fleet?.map((ship) => [ship.id, ship.size])).toEqual([
      ["carrier", 5],
      ["battleship", 4],
      ["cruiser", 3],
      ["submarine", 3],
      ["patrol", 2]
    ]);
    expect(state.meta?.battleship?.botShips).toHaveLength(17);
  });

  it("registers Flappy Bird as a solo arcade game", () => {
    const state = createGameState("flappy-bird");

    expect(getGameDefinition("flappy-bird")).toMatchObject({
      name: "Flappy Bird",
      supportsFriend: false
    });
    expect(isSoloGame("flappy-bird")).toBe(true);
    expect(state.board).toEqual([[null]]);
    expect(chooseBotMove(state, "p2", "ruthless")).toBeNull();
  });

  it("registers Snake and 2048 as solo games", () => {
    expect(getGameDefinition("snake")).toMatchObject({
      name: "Snake",
      supportsFriend: false
    });
    expect(getGameDefinition("twenty-forty-eight")).toMatchObject({
      name: "2048",
      supportsFriend: false
    });
    expect(isSoloGame("snake")).toBe(true);
    expect(isSoloGame("twenty-forty-eight")).toBe(true);
    expect(chooseBotMove(createGameState("snake"), "p2", "ruthless")).toBeNull();
    expect(chooseBotMove(createGameState("twenty-forty-eight"), "p2", "ruthless")).toBeNull();
  });

  it("deals Uno hands and starts on a number discard", () => {
    const state = createGameState("last-card");
    const meta = state.meta?.lastCard;

    expect(getGameDefinition("last-card")).toMatchObject({
      name: "Uno",
      supportsFriend: true
    });
    expect(meta?.hands.p1).toHaveLength(7);
    expect(meta?.hands.p2).toHaveLength(7);
    expect(meta?.handCounts).toEqual({ p1: 7, p2: 7 });
    expect(meta?.discard).toHaveLength(1);
    expect(Number(meta?.discard[0].rank)).not.toBeNaN();
  });

  it("plays Uno matches by color or rank and updates hand counts", () => {
    const state = createGameState("last-card");
    state.meta!.lastCard = {
      deck: [],
      deckCount: 0,
      discard: [{ id: "red-5-table", color: "red", rank: "5" }],
      hands: {
        p1: [
          { id: "blue-5-a", color: "blue", rank: "5" },
          { id: "green-2-a", color: "green", rank: "2" }
        ],
        p2: [{ id: "yellow-9-a", color: "yellow", rank: "9" }]
      },
      handCounts: { p1: 2, p2: 1 },
      currentColor: "red"
    };

    const next = play(state, "p1", { column: 0 });

    expect(next.meta?.lastCard?.discard.at(-1)).toMatchObject({ color: "blue", rank: "5" });
    expect(next.meta?.lastCard?.handCounts).toEqual({ p1: 1, p2: 1 });
    expect(next.turn).toBe("p2");
  });

  it("applies Uno draw-two as a skipped opponent turn", () => {
    const state = createGameState("last-card");
    state.meta!.lastCard = {
      deck: [
        { id: "green-1-a", color: "green", rank: "1" },
        { id: "yellow-4-a", color: "yellow", rank: "4" }
      ],
      deckCount: 2,
      discard: [{ id: "red-5-table", color: "red", rank: "5" }],
      hands: {
        p1: [{ id: "red-draw2-a", color: "red", rank: "draw2" }],
        p2: [{ id: "blue-9-a", color: "blue", rank: "9" }]
      },
      handCounts: { p1: 1, p2: 1 },
      currentColor: "red"
    };

    const next = play(state, "p1", { column: 0 });

    expect(next.winner).toBe("p1");
    expect(next.turn).toBe("p1");
    expect(next.meta?.lastCard?.handCounts.p2).toBe(3);
    expect(next.meta?.lastCard?.lastDraw).toEqual({ player: "p2", count: 2 });
  });

  it("applies Uno wild draw-four and chooses the next table color", () => {
    const state = createGameState("last-card");
    state.meta!.lastCard = {
      deck: [
        { id: "blue-1-a", color: "blue", rank: "1" },
        { id: "yellow-4-a", color: "yellow", rank: "4" },
        { id: "red-3-a", color: "red", rank: "3" },
        { id: "blue-8-a", color: "blue", rank: "8" }
      ],
      deckCount: 4,
      discard: [{ id: "red-5-table", color: "red", rank: "5" }],
      hands: {
        p1: [
          { id: "wild-four-a", color: "wild", rank: "wild4" },
          { id: "green-2-a", color: "green", rank: "2" }
        ],
        p2: [{ id: "blue-9-a", color: "blue", rank: "9" }]
      },
      handCounts: { p1: 2, p2: 1 },
      currentColor: "red"
    };

    const next = play(state, "p1", { column: 0 });

    expect(next.turn).toBe("p1");
    expect(next.meta?.lastCard?.currentColor).toBe("green");
    expect(next.meta?.lastCard?.handCounts).toEqual({ p1: 1, p2: 5 });
    expect(next.meta?.lastCard?.lastDraw).toEqual({ player: "p2", count: 4 });
  });

  it("chooses a sharp Uno action card before a plain match", () => {
    const state = createGameState("last-card");
    state.turn = "p2";
    state.meta!.lastCard = {
      deck: [],
      deckCount: 0,
      discard: [{ id: "red-5-table", color: "red", rank: "5" }],
      hands: {
        p1: [
          { id: "green-1-a", color: "green", rank: "1" },
          { id: "green-2-a", color: "green", rank: "2" }
        ],
        p2: [
          { id: "red-draw2-a", color: "red", rank: "draw2" },
          { id: "blue-5-a", color: "blue", rank: "5" }
        ]
      },
      handCounts: { p1: 2, p2: 2 },
      currentColor: "red"
    };

    expect(chooseBotMove(state, "p2", "ruthless")).toEqual({ column: 0 });
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

  it("opens ruthless Four in a Row from an attacking flank instead of the center", () => {
    expect(chooseBotMove(createGameState("four-in-a-row"), "p1", "ruthless")).toEqual({ column: 2 });
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
