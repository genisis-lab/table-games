import { describe, expect, it, vi } from "vitest";
import {
  applyGameMove,
  chooseBotMove,
  createGameState,
  finalizeGameState,
  GAME_IDS,
  getBoardVariantOptions,
  getGameDefinition,
  getLegalMoves,
  isSoloGame,
  maskGameMetaForPlayer,
  type BattleshipShip,
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

function setDefendingBattleshipFleet(state: GameState, ship: BattleshipShip): void {
  const battleship = state.meta?.battleship;
  if (!battleship) throw new Error("Expected Sea Battle metadata");
  battleship.playerFleet = [ship];
  battleship.playerShips = ship.cells.map((cell) => ({ ...cell }));
}

describe("Game catalog integrity", () => {
  it("creates rectangular state for every visible game variant", () => {
    for (const gameId of GAME_IDS) {
      for (const option of getBoardVariantOptions(gameId)) {
        const state = createGameState(gameId, option.id);
        expect(state.gameId).toBe(gameId);
        expect(state.boardVariant).toBe(option.id);
        expect(state.board.length).toBeGreaterThan(0);
        expect(state.board[0].length).toBeGreaterThan(0);
        expect(state.board.every((row) => row.length === state.board[0].length)).toBe(true);
      }
    }
  });

  it("can apply the first legal move for every non-solo game", () => {
    for (const gameId of GAME_IDS.filter((candidate) => !isSoloGame(candidate))) {
      const state = createGameState(gameId);
      const legalMoves = getLegalMoves(state);
      expect(legalMoves.length, `${gameId} should expose at least one opening move`).toBeGreaterThan(0);

      const result = applyGameMove(state, state.turn, legalMoves[0]);
      expect(result.ok, `${gameId} should accept its first legal move`).toBe(true);
    }
  });

  it("can apply an opening legal move for every visible non-solo game variant", () => {
    for (const gameId of GAME_IDS.filter((candidate) => !isSoloGame(candidate))) {
      for (const option of getBoardVariantOptions(gameId)) {
        const state = createGameState(gameId, option.id);
        const legalMoves = getLegalMoves(state);
        const label = `${gameId} ${option.id}`;
        expect(legalMoves.length, `${label} should expose at least one opening move`).toBeGreaterThan(0);

        const result = applyGameMove(state, state.turn, legalMoves[0]);
        expect(result.ok, `${label} should accept its first legal move`).toBe(true);
      }
    }
  });

  it("chooses a valid bot move for every bot-supported table game", () => {
    for (const gameId of GAME_IDS.filter((candidate) => !isSoloGame(candidate))) {
      const state = createGameState(gameId);
      const move = chooseBotMove(state, state.turn, "sharp");
      expect(move, `${gameId} should choose a bot move`).not.toBeNull();

      const result = applyGameMove(state, state.turn, move!);
      expect(result.ok, `${gameId} bot move should be legal`).toBe(true);
    }
  });

  it("chooses a valid bot move for every visible non-solo game variant", () => {
    for (const gameId of GAME_IDS.filter((candidate) => !isSoloGame(candidate))) {
      for (const option of getBoardVariantOptions(gameId)) {
        const state = createGameState(gameId, option.id);
        const label = `${gameId} ${option.id}`;
        const move = chooseBotMove(state, state.turn, "sharp");
        expect(move, `${label} should choose a bot move`).not.toBeNull();

        const result = applyGameMove(state, state.turn, move!);
        expect(result.ok, `${label} bot move should be legal`).toBe(true);
      }
    }
  });
});

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

  it("enforces Ultimate Tic Tac Toe sent-board targeting", () => {
    let state = createGameState("ultimate-tic-tac-toe");
    state = play(state, "p1", { row: 8, column: 8 });

    expect(applyGameMove(state, "p2", { row: 0, column: 0 })).toMatchObject({
      ok: false,
      reason: "Play inside the highlighted small board."
    });
  });

  it("lets Ultimate Tic Tac Toe players choose any board when sent to a claimed board", () => {
    let state = createGameState("ultimate-tic-tac-toe");
    state.meta!.ultimate!.localWinners[0] = "p2";

    state = play(state, "p1", { row: 6, column: 6 });

    expect(state.meta?.ultimate?.activeBoard).toBeNull();
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
    dots.scores = { p1: 4, p2: 4, p3: 0, p4: 0 };
    state.turn = "p1";

    const result = applyGameMove(state, "p1", { edge: "h", row: 0, column: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.meta?.dots?.scores).toEqual({ p1: 5, p2: 4, p3: 0, p4: 0 });
    expect(result.state.winner).toBe("p1");
  });

  it("flips captured discs in Reversi", () => {
    const state = play(createGameState("reversi"), "p1", { row: 2, column: 3 });

    expect(state.board[2][3]).toBe("p1");
    expect(state.board[3][3]).toBe("p1");
  });

  it("passes a Reversi turn when the opponent has no legal move", () => {
    const state = createGameState("reversi");
    state.board = [
      [null, "p2", "p2", null, null, null, "p2", "p2"],
      [null, null, null, "p2", null, null, "p2", null],
      [null, null, null, "p2", null, "p2", "p2", "p1"],
      ["p1", "p2", null, null, null, null, "p1", "p1"],
      [null, null, "p2", null, "p1", null, "p2", "p1"],
      ["p2", "p2", null, null, "p1", null, "p2", null],
      ["p1", "p2", null, "p1", null, null, "p2", null],
      [null, null, null, null, null, null, null, null]
    ];
    state.turn = "p1";

    const next = play(state, "p1", { row: 4, column: 0 });

    expect(next.board[5][0]).toBe("p1");
    expect(next.turn).toBe("p1");
    expect(next.winner).toBeNull();
    expect(getLegalMoves(next).length).toBeGreaterThan(0);
  });

  it("ends Reversi when neither side has a legal move", () => {
    const state = createGameState("reversi");
    state.board = Array.from({ length: 8 }, () => Array.from<Cell>({ length: 8 }).fill("p1"));
    state.board[0][0] = null;
    state.board[0][1] = "p2";
    state.turn = "p1";

    const next = play(state, "p1", { row: 0, column: 0 });

    expect(next.winner).toBe("p1");
    expect(next.board.flat().filter((cell) => cell === "p2")).toHaveLength(0);
  });

  it("moves and promotes Checkers pieces", () => {
    let state = createGameState("checkers");
    state.board = Array.from({ length: 8 }, () => Array.from<Cell>({ length: 8 }).fill(null));
    state.board[1][2] = "p1";

    state = play(state, "p1", { row: 1, column: 2, toRow: 0, toColumn: 3 });

    expect(state.board[0][3]).toBe("p1");
    expect(state.meta?.checkers?.kings).toContain("0,3");
  });

  it("forces Checkers jumps when a capture is available", () => {
    const state = createGameState("checkers");
    state.board = Array.from({ length: 8 }, () => Array.from<Cell>({ length: 8 }).fill(null));
    state.board[5][0] = "p1";
    state.board[4][1] = "p2";
    state.board[5][4] = "p1";

    expect(applyGameMove(state, "p1", { row: 5, column: 4, toRow: 4, toColumn: 5 })).toMatchObject({
      ok: false,
      reason: "You must take a jump when one is available."
    });
  });

  it("keeps a Checkers turn alive for a multi-jump", () => {
    let state = createGameState("checkers");
    state.board = Array.from({ length: 8 }, () => Array.from<Cell>({ length: 8 }).fill(null));
    state.board[5][0] = "p1";
    state.board[4][1] = "p2";
    state.board[2][3] = "p2";

    state = play(state, "p1", { row: 5, column: 0, toRow: 3, toColumn: 2 });

    expect(state.turn).toBe("p1");
    expect(state.meta?.checkers?.mustContinueFrom).toBe("3,2");
    expect(applyGameMove(state, "p1", { row: 3, column: 2, toRow: 2, toColumn: 1 })).toMatchObject({
      ok: false,
      reason: "You must take a jump when one is available."
    });

    state = play(state, "p1", { row: 3, column: 2, toRow: 1, toColumn: 4 });

    expect(state.board[1][4]).toBe("p1");
    expect(state.board[2][3]).toBeNull();
    expect(state.turn).toBe("p2");
    expect(state.meta?.checkers?.mustContinueFrom).toBeNull();
  });

  it("lets Checkers kings capture backward", () => {
    let state = createGameState("checkers");
    state.board = Array.from({ length: 8 }, () => Array.from<Cell>({ length: 8 }).fill(null));
    state.board[2][3] = "p1";
    state.board[3][4] = "p2";
    state.meta!.checkers!.kings = ["2,3"];

    state = play(state, "p1", { row: 2, column: 3, toRow: 4, toColumn: 5 });

    expect(state.board[4][5]).toBe("p1");
    expect(state.board[3][4]).toBeNull();
    expect(state.meta?.checkers?.kings).toContain("4,5");
  });

  it("forces Checkers multi-jumps to continue from the same checker", () => {
    let state = createGameState("checkers");
    state.board = Array.from({ length: 8 }, () => Array.from<Cell>({ length: 8 }).fill(null));
    state.board[5][0] = "p1";
    state.board[4][1] = "p2";
    state.board[2][3] = "p2";
    state.board[5][6] = "p1";

    state = play(state, "p1", { row: 5, column: 0, toRow: 3, toColumn: 2 });

    expect(applyGameMove(state, "p1", { row: 5, column: 6, toRow: 4, toColumn: 7 })).toMatchObject({
      ok: false,
      reason: "Continue the jump with the same checker."
    });
  });

  it("records hits in Sea Battle", () => {
    const state = createGameState("battleship");
    const firstShip = state.meta?.battleship?.botShips[0];
    expect(firstShip).toBeTruthy();

    const next = play(state, "p1", { row: firstShip!.row, column: firstShip!.column });
    expect(next.meta?.battleship?.humanShots[`${firstShip!.row},${firstShip!.column}`]).toBe("hit");
  });

  it("groups Sea Battle fleets into named ships for sunk-ship reveals", () => {
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

  it("keeps Sea Battle fleets in-bounds and non-overlapping", () => {
    const state = createGameState("battleship");
    const fleet = state.meta?.battleship?.botFleet ?? [];
    const cells = fleet.flatMap((ship) => ship.cells);
    const keys = new Set(cells.map((cell) => `${cell.row},${cell.column}`));

    expect(cells).toHaveLength(17);
    expect(keys.size).toBe(17);
    expect(cells.every((cell) => cell.row >= 0 && cell.row < 10 && cell.column >= 0 && cell.column < 10)).toBe(true);
  });

  it("masks live enemy Sea Battle ships while revealing sunk ships", () => {
    const state = createGameState("battleship");
    const meta = state.meta?.battleship;
    const firstShip = meta?.botFleet[0];
    expect(meta).toBeTruthy();
    expect(firstShip).toBeTruthy();

    expect(maskGameMetaForPlayer(state.meta, "p1")?.battleship?.botFleet).toHaveLength(0);

    for (const cell of firstShip!.cells) {
      meta!.humanShots[`${cell.row},${cell.column}`] = "hit";
    }

    const masked = maskGameMetaForPlayer(state.meta, "p1")?.battleship;
    expect(masked?.botFleet).toHaveLength(1);
    expect(masked?.botFleet[0].id).toBe(firstShip!.id);
    expect(masked?.botShips).toHaveLength(firstShip!.size);
    expect(masked?.playerFleet).toHaveLength(5);
    expect(masked?.playerShips).toHaveLength(17);
  });

  it("registers Pipe Dash as a solo arcade game", () => {
    const state = createGameState("flappy-bird");

    expect(getGameDefinition("flappy-bird")).toMatchObject({
      name: "Pipe Dash",
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

  it("deals Color Clash hands and starts on a number discard", () => {
    const state = createGameState("last-card");
    const meta = state.meta?.lastCard;

    expect(getGameDefinition("last-card")).toMatchObject({
      name: "Color Clash",
      supportsFriend: true
    });
    expect(meta?.hands.p1).toHaveLength(7);
    expect(meta?.hands.p2).toHaveLength(7);
    expect(meta?.handCounts).toEqual({ p1: 7, p2: 7, p3: 0, p4: 0 });
    expect(meta?.discard).toHaveLength(1);
    expect(Number(meta?.discard[0].rank)).not.toBeNaN();
  });

  it("plays Color Clash matches by color or rank and updates hand counts", () => {
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
        p2: [{ id: "yellow-9-a", color: "yellow", rank: "9" }],
        p3: [],
        p4: []
      },
      handCounts: { p1: 2, p2: 1, p3: 0, p4: 0 },
      currentColor: "red"
    };

    const next = play(state, "p1", { column: 0 });

    expect(next.meta?.lastCard?.discard.at(-1)).toMatchObject({ color: "blue", rank: "5" });
    expect(next.meta?.lastCard?.handCounts).toEqual({ p1: 1, p2: 1, p3: 0, p4: 0 });
    expect(next.turn).toBe("p2");
  });

  it("applies Color Clash draw-two as a skipped opponent turn", () => {
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
        p2: [{ id: "blue-9-a", color: "blue", rank: "9" }],
        p3: [],
        p4: []
      },
      handCounts: { p1: 1, p2: 1, p3: 0, p4: 0 },
      currentColor: "red"
    };

    const next = play(state, "p1", { column: 0 });

    expect(next.winner).toBe("p1");
    expect(next.turn).toBe("p1");
    expect(next.meta?.lastCard?.handCounts.p2).toBe(3);
    expect(next.meta?.lastCard?.lastDraw).toEqual({ player: "p2", count: 2 });
  });

  it("applies Color Clash wild draw-four and chooses the next table color", () => {
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
        p2: [{ id: "blue-9-a", color: "blue", rank: "9" }],
        p3: [],
        p4: []
      },
      handCounts: { p1: 2, p2: 1, p3: 0, p4: 0 },
      currentColor: "red"
    };

    const next = play(state, "p1", { column: 0, color: "green" });

    expect(next.turn).toBe("p1");
    expect(next.meta?.lastCard?.currentColor).toBe("green");
    expect(next.meta?.lastCard?.handCounts).toEqual({ p1: 1, p2: 5, p3: 0, p4: 0 });
    expect(next.meta?.lastCard?.lastDraw).toEqual({ player: "p2", count: 4 });
  });

  it("blocks Color Clash wild draw-four when the player can follow the table color", () => {
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
          { id: "red-2-a", color: "red", rank: "2" }
        ],
        p2: [{ id: "blue-9-a", color: "blue", rank: "9" }],
        p3: [],
        p4: []
      },
      handCounts: { p1: 2, p2: 1, p3: 0, p4: 0 },
      currentColor: "red"
    };

    expect(getLegalMoves(state)).toEqual([{ column: 1 }]);
    expect(applyGameMove(state, "p1", { column: 0 })).toMatchObject({
      ok: false,
      reason: "Match the discard color or rank."
    });
  });

  it("chooses a sharp Color Clash action card before a plain match", () => {
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
        ],
        p3: [],
        p4: []
      },
      handCounts: { p1: 2, p2: 2, p3: 0, p4: 0 },
      currentColor: "red"
    };

    expect(chooseBotMove(state, "p2", "ruthless")).toEqual({ column: 0 });
  });

  it("only lets a stuck Color Clash player draw", () => {
    const state = createGameState("last-card");
    state.meta!.lastCard = {
      deck: [{ id: "yellow-4-a", color: "yellow", rank: "4" }],
      deckCount: 1,
      discard: [{ id: "red-5-table", color: "red", rank: "5" }],
      hands: {
        p1: [{ id: "red-7-a", color: "red", rank: "7" }],
        p2: [{ id: "blue-9-a", color: "blue", rank: "9" }],
        p3: [],
        p4: []
      },
      handCounts: { p1: 1, p2: 1, p3: 0, p4: 0 },
      currentColor: "red"
    };

    expect(getLegalMoves(state)).toEqual([{ column: 0 }]);
    expect(applyGameMove(state, "p1", { column: -1 })).toMatchObject({
      ok: false,
      reason: "Play a matching card before drawing."
    });
  });

  it("keeps a Color Clash turn when the drawn card can be played", () => {
    const state = createGameState("last-card");
    state.meta!.lastCard = {
      deck: [{ id: "red-7-a", color: "red", rank: "7" }],
      deckCount: 1,
      discard: [{ id: "red-5-table", color: "red", rank: "5" }],
      hands: {
        p1: [{ id: "green-2-a", color: "green", rank: "2" }],
        p2: [{ id: "blue-9-a", color: "blue", rank: "9" }],
        p3: [],
        p4: []
      },
      handCounts: { p1: 1, p2: 1, p3: 0, p4: 0 },
      currentColor: "red"
    };

    const next = play(state, "p1", { column: -1 });

    expect(next.turn).toBe("p1");
    expect(next.meta?.lastCard?.hands.p1.at(-1)).toMatchObject({ color: "red", rank: "7" });
    expect(next.meta?.lastCard?.lastDraw).toEqual({ player: "p1", count: 1, playable: true, cardId: "red-7-a" });
  });

  it("passes a Color Clash turn when the drawn card is still unplayable", () => {
    const state = createGameState("last-card");
    state.meta!.lastCard = {
      deck: [{ id: "blue-7-a", color: "blue", rank: "7" }],
      deckCount: 1,
      discard: [{ id: "red-5-table", color: "red", rank: "5" }],
      hands: {
        p1: [{ id: "green-2-a", color: "green", rank: "2" }],
        p2: [{ id: "yellow-9-a", color: "yellow", rank: "9" }],
        p3: [],
        p4: []
      },
      handCounts: { p1: 1, p2: 1, p3: 0, p4: 0 },
      currentColor: "red"
    };

    const next = play(state, "p1", { column: -1 });

    expect(next.turn).toBe("p2");
    expect(next.meta?.lastCard?.lastDraw).toEqual({ player: "p1", count: 1, playable: false, cardId: "blue-7-a" });
  });

  it("sows stones and updates stores in Mancala", () => {
    const state = play(createGameState("mancala"), "p1", { column: 2 });

    expect(state.meta?.mancala?.pits.p1[2]).toBe(0);
    expect(state.meta?.mancala?.stores.p1).toBe(1);
  });

  it("gives Mancala an extra turn when the last stone lands in the store", () => {
    const state = createGameState("mancala");
    state.meta!.mancala!.pits.p1 = [1, 0, 0, 0, 0, 1];
    state.meta!.mancala!.pits.p2 = [4, 4, 4, 4, 4, 4];

    const next = play(state, "p1", { column: 5 });

    expect(next.meta?.mancala?.stores.p1).toBe(1);
    expect(next.turn).toBe("p1");
    expect(next.winner).toBeNull();
  });

  it("captures opposite Mancala stones from an empty own pit", () => {
    const state = createGameState("mancala");
    state.meta!.mancala!.pits.p1 = [1, 0, 1, 0, 0, 0];
    state.meta!.mancala!.pits.p2 = [1, 0, 4, 0, 0, 0];

    const next = play(state, "p1", { column: 2 });

    expect(next.meta?.mancala?.stores.p1).toBe(5);
    expect(next.meta?.mancala?.pits.p1[3]).toBe(0);
    expect(next.meta?.mancala?.pits.p2[2]).toBe(0);
  });

  it("sweeps remaining Mancala stones and decides the winner when a side empties", () => {
    const state = createGameState("mancala");
    state.meta!.mancala!.pits.p1 = [0, 0, 0, 0, 0, 1];
    state.meta!.mancala!.pits.p2 = [1, 1, 1, 1, 1, 1];

    const next = play(state, "p1", { column: 5 });

    expect(next.meta?.mancala?.pits.p1).toEqual([0, 0, 0, 0, 0, 0]);
    expect(next.meta?.mancala?.pits.p2).toEqual([0, 0, 0, 0, 0, 0]);
    expect(next.meta?.mancala?.stores).toMatchObject({ p1: 1, p2: 6 });
    expect(next.winner).toBe("p2");
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

  it("detects the second player's connected Hex path", () => {
    let state = createGameState("hex");

    for (let row = 0; row < 11; row += 1) {
      state = play(state, "p1", { row, column: 10 });
      state = play(state, "p2", { row, column: 0 });
    }

    expect(state.winner).toBe("p2");
    expect(state.winningLine.map((point) => point.row)).toEqual(Array.from({ length: 11 }, (_, row) => row));
  });

  it("places Nine Men's Morris pieces and waits for the mill maker to choose a capture", () => {
    let state = createGameState("nine-mens-morris");
    state = play(state, "p1", { row: 0, column: 0 });
    state = play(state, "p2", { row: 1, column: 1 });
    state = play(state, "p1", { row: 0, column: 3 });
    state = play(state, "p2", { row: 1, column: 3 });
    state = play(state, "p1", { row: 0, column: 6 });

    expect(state.meta?.morris?.placed.p1).toBe(3);
    expect(state.meta?.morris?.pendingRemoval).toBe("p1");
    expect(state.turn).toBe("p1");
    expect(state.board.flat().filter((cell) => cell === "p2")).toHaveLength(2);

    state = play(state, "p1", { row: 1, column: 1 });

    expect(state.board.flat().filter((cell) => cell === "p2")).toHaveLength(1);
    expect(state.board[1][1]).toBeNull();
    expect(state.meta?.morris?.removed.p2).toBe(1);
    expect(state.meta?.morris?.pendingRemoval).toBeNull();
    expect(state.turn).toBe("p2");
  });

  it("protects Nine Men's Morris pieces inside mills while exposed pieces can be removed", () => {
    const state = createGameState("nine-mens-morris");
    state.board = Array.from({ length: 7 }, () => Array.from<Cell>({ length: 7 }).fill(null));
    state.board[0][0] = "p1";
    state.board[0][3] = "p1";
    state.board[0][6] = "p1";
    state.board[1][1] = "p2";
    state.board[1][3] = "p2";
    state.board[1][5] = "p2";
    state.board[3][0] = "p2";
    state.turn = "p1";
    state.meta!.morris = {
      placed: { p1: 9, p2: 9, p3: 0, p4: 0 },
      removed: { p1: 0, p2: 0, p3: 0, p4: 0 },
      pendingRemoval: "p1"
    };

    expect(applyGameMove(state, "p1", { row: 1, column: 1 })).toMatchObject({
      ok: false,
      reason: "Choose an exposed opponent piece."
    });

    const result = applyGameMove(state, "p1", { row: 3, column: 0 });

    expect(result.ok).toBe(true);
    expect(result.state.board[3][0]).toBeNull();
    expect(result.state.turn).toBe("p2");
  });

  it("requires Nine Men's Morris sliding pieces to move along connected points", () => {
    const state = createGameState("nine-mens-morris");
    state.board = Array.from({ length: 7 }, () => Array.from<Cell>({ length: 7 }).fill(null));
    state.board[0][0] = "p1";
    state.board[0][6] = "p1";
    state.board[1][1] = "p1";
    state.board[3][0] = "p1";
    state.board[6][0] = "p2";
    state.board[6][3] = "p2";
    state.board[5][5] = "p2";
    state.turn = "p1";
    state.meta!.morris = {
      placed: { p1: 9, p2: 9, p3: 0, p4: 0 },
      removed: { p1: 0, p2: 0, p3: 0, p4: 0 },
      pendingRemoval: null
    };

    expect(applyGameMove(state, "p1", { row: 0, column: 0, toRow: 6, toColumn: 6 })).toMatchObject({
      ok: false,
      reason: "Slide to a connected point."
    });

    const result = applyGameMove(state, "p1", { row: 0, column: 0, toRow: 0, toColumn: 3 });
    expect(result.ok).toBe(true);
    expect(result.state.board[0][3]).toBe("p1");
  });

  it("lets Nine Men's Morris pieces fly once a player is down to three pieces", () => {
    const state = createGameState("nine-mens-morris");
    state.board = Array.from({ length: 7 }, () => Array.from<Cell>({ length: 7 }).fill(null));
    state.board[0][0] = "p1";
    state.board[0][3] = "p1";
    state.board[1][1] = "p1";
    state.board[6][0] = "p2";
    state.board[6][3] = "p2";
    state.board[5][5] = "p2";
    state.turn = "p1";
    state.meta!.morris = {
      placed: { p1: 9, p2: 9, p3: 0, p4: 0 },
      removed: { p1: 6, p2: 6, p3: 0, p4: 0 },
      pendingRemoval: null
    };

    const result = applyGameMove(state, "p1", { row: 0, column: 0, toRow: 6, toColumn: 6 });

    expect(result.ok).toBe(true);
    expect(result.state.board[6][6]).toBe("p1");
  });

  it("wins Nine Men's Morris when a fully placed opponent has no legal slide", () => {
    const state = createGameState("nine-mens-morris");
    state.board = Array.from({ length: 7 }, () => Array.from<Cell>({ length: 7 }).fill(null));
    state.board[0][0] = "p2";
    state.board[0][6] = "p2";
    state.board[6][0] = "p2";
    state.board[6][6] = "p2";
    state.board[0][3] = "p1";
    state.board[3][0] = "p1";
    state.board[3][6] = "p1";
    state.board[6][3] = "p1";
    state.board[1][1] = "p1";
    state.turn = "p1";
    state.meta!.morris = {
      placed: { p1: 9, p2: 9, p3: 0, p4: 0 },
      removed: { p1: 0, p2: 0, p3: 0, p4: 0 },
      pendingRemoval: null
    };

    const result = applyGameMove(state, "p1", { row: 1, column: 1, toRow: 1, toColumn: 3 });

    expect(result.ok).toBe(true);
    expect(result.state.winner).toBe("p1");
  });
});

describe("New table games", () => {
  it("scores Darts throws and advances after three darts", () => {
    let state = createGameState("darts");
    state = play(state, "p1", { row: 3, column: 0 });
    state = play(state, "p1", { row: 3, column: 0 });
    state = play(state, "p1", { row: 3, column: 0 });

    expect(state.meta?.darts?.scores.p1).toBe(121);
    expect(state.meta?.darts?.dartsLeft).toBe(3);
    expect(state.turn).toBe("p2");
  });

  it("treats Darts misses as thrown darts without changing score", () => {
    const state = play(createGameState("darts"), "p1", { row: 0, column: -1 });

    expect(state.meta?.darts?.scores.p1).toBe(301);
    expect(state.meta?.darts?.dartsLeft).toBe(2);
    expect(state.meta?.darts?.throws.at(-1)).toMatchObject({ label: "Miss", score: 0 });
    expect(state.turn).toBe("p1");
  });

  it("requires Darts checkout to land on a double and resets the visit on bust", () => {
    let state = createGameState("darts");
    state.meta!.darts!.scores.p1 = 60;
    state = play(state, "p1", { row: 3, column: 0 });

    expect(state.winner).toBeNull();
    expect(state.meta?.darts?.scores.p1).toBe(60);
    expect(state.turn).toBe("p2");

    state = { ...state, turn: "p1", winner: null, meta: { ...state.meta, darts: { ...state.meta!.darts!, scores: { ...state.meta!.darts!.scores, p1: 40 } } } };
    state = play(state, "p1", { row: 2, column: 0 });

    expect(state.winner).toBe("p1");
    expect(state.meta?.darts?.scores.p1).toBe(0);
  });

  it("generates a unique Word Hunt board and rejects duplicate words", () => {
    const state = createGameState("word-hunt");
    const word = state.meta?.wordHunt?.words[0];
    const secondWord = state.meta?.wordHunt?.words.find((candidate) => candidate !== word);
    expect(word).toBeTruthy();
    expect(secondWord).toBeTruthy();

    const next = play(state, "p1", { column: 0, word });
    expect(next.meta?.wordHunt?.found.p1).toContain(word);
    expect(next.meta?.wordHunt?.scores.p1).toBeGreaterThan(0);
    const raced = play(next, "p2", { column: 0, word: secondWord });
    expect(raced.meta?.wordHunt?.found.p2).toContain(secondWord);
    expect(applyGameMove({ ...next, turn: "p2" }, "p2", { column: 0, word })).toMatchObject({
      ok: false
    });
  });

  it("ends Word Hunt by timer and awards the highest score", () => {
    const state = createGameState("word-hunt");
    const expired = {
      ...state,
      meta: {
        ...state.meta,
        wordHunt: {
          ...state.meta!.wordHunt!,
          scores: { p1: 4, p2: 2, p3: 0, p4: 0 },
          roundStartedAt: Date.now() - 5_000,
          durationMs: 1
        }
      }
    };

    const result = applyGameMove(expired, "p2", { column: 0, word: state.meta?.wordHunt?.words[0] });
    expect(result.ok).toBe(true);
    expect(result.state.winner).toBe("p1");
  });

  it("finalizes an expired Word Hunt snapshot without another submitted word", () => {
    const state = createGameState("word-hunt");
    const expired = {
      ...state,
      meta: {
        ...state.meta,
        wordHunt: {
          ...state.meta!.wordHunt!,
          scores: { p1: 2, p2: 6, p3: 0, p4: 0 },
          roundStartedAt: Date.now() - 5_000,
          durationMs: 1
        }
      }
    };

    expect(finalizeGameState(expired).winner).toBe("p2");
  });

  it("removes targeted cups and keeps the shooter until both Cup Pong balls are thrown", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const state = play(createGameState("cup-pong"), "p1", { column: 0, power: 0.5, aim: 0 });

    expect(state.meta?.cupPong?.cups.p2[0]).toBe(false);
    expect(state.meta?.cupPong?.made.p1).toBe(1);
    expect(state.meta?.cupPong?.ballsRemaining).toBe(1);
    expect(state.turn).toBe("p1");

    const next = play(state, "p1", { column: 1, power: 0.5, aim: 0 });
    expect(next.meta?.cupPong?.cups.p2[1]).toBe(false);
    expect(next.turn).toBe("p2");
    random.mockRestore();
  });

  it("offers and applies Cup Pong re-racks only for scattered threshold racks", () => {
    const base = createGameState("cup-pong");
    const state: GameState = {
      ...base,
      meta: {
        ...base.meta,
        cupPong: {
          ...base.meta!.cupPong!,
          cups: {
            ...base.meta!.cupPong!.cups,
            p2: [false, true, false, true, true, true]
          }
        }
      }
    };

    expect(getLegalMoves(state).some((move) => move.column === -1)).toBe(true);

    const result = applyGameMove(state, "p1", { column: -1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.column).toBe(-1);
    expect(result.state.turn).toBe("p1");
    expect(result.state.meta?.cupPong?.cups.p2).toEqual([true, true, true, true, false, false]);
    expect(result.state.meta?.cupPong?.ballsRemaining).toBe(2);
    expect(result.state.meta?.cupPong?.reRackAvailable).toBe(false);
  });

  it("does not offer Cup Pong re-racks for already packed racks", () => {
    const base = createGameState("cup-pong");
    const state: GameState = {
      ...base,
      meta: {
        ...base.meta,
        cupPong: {
          ...base.meta!.cupPong!,
          cups: {
            ...base.meta!.cupPong!.cups,
            p2: [true, true, true, true, false, false]
          }
        }
      }
    };

    expect(getLegalMoves(state).some((move) => move.column === -1)).toBe(false);

    const result = applyGameMove(state, "p1", { column: -1 });
    expect(result.ok).toBe(false);
  });

  it("deals four Dominoes hands and starts a matching chain", () => {
    const state = createGameState("dominoes");
    const firstTile = state.meta?.dominoes?.hands.p1[0];
    expect(state.meta?.dominoes?.hands.p3).toHaveLength(7);
    expect(firstTile).toBeTruthy();

    const result = applyGameMove(state, "p1", { column: 0, edge: "v" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.meta?.dominoes?.chain[0]).toMatchObject(firstTile!);
    expect(result.state.turn).toBe("p2");
  });

  it("plays Order & Chaos marks through shared moves", () => {
    const state = createGameState("order-and-chaos");
    const result = applyGameMove(state, "p1", { column: 0, piece: "X" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.meta?.orderChaos?.board[0]).toBe("X");
    expect(result.state.turn).toBe("p2");
  });

  it("masks unrevealed Memory Match cards", () => {
    const state = createGameState("memory-match");
    const result = applyGameMove(state, "p1", { column: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const masked = maskGameMetaForPlayer(result.state.meta, "p2");
    expect(masked?.memoryMatch?.cards[0].value).not.toBe(-1);
    expect(masked?.memoryMatch?.cards[1].value).toBe(-1);
  });

  it("keeps the Set Trio table public without revealing the future draw order", () => {
    const state = createGameState("set-trio");
    const originalDeck = state.meta?.setTrio?.deck;
    const masked = maskGameMetaForPlayer(state.meta, "p1")?.setTrio;

    expect(originalDeck?.length).toBeGreaterThan(0);
    expect(masked?.board).toEqual(state.meta?.setTrio?.board);
    expect(masked?.deck).toEqual([]);
    expect(masked?.deckRemaining).toBe(originalDeck?.length);
    expect(state.meta?.setTrio?.deck).toBe(originalDeck);
  });

  it("keeps a mismatched Memory pair visible until the next player acts", () => {
    const state = createGameState("memory-match");
    const memory = state.meta!.memoryMatch!;
    memory.cards = [
      { value: 0, matched: false },
      { value: 1, matched: false },
      { value: 0, matched: false },
      { value: 1, matched: false }
    ];
    memory.columns = 2;
    memory.pairsRemaining = 2;
    memory.faceUp = [];
    memory.pendingMismatch = false;
    memory.seen = { p1: {}, p2: {}, p3: {}, p4: {} };

    const first = play(state, "p1", { column: 0 });
    const mismatch = play(first, "p1", { column: 1 });
    expect(mismatch.turn).toBe("p2");
    expect(mismatch.meta?.memoryMatch?.faceUp).toEqual([0, 1]);
    expect(mismatch.meta?.memoryMatch?.pendingMismatch).toBe(true);
    const visible = maskGameMetaForPlayer(mismatch.meta, "p2");
    expect(visible?.memoryMatch?.cards.slice(0, 2).map((card) => card.value)).toEqual([0, 1]);

    const next = play(mismatch, "p2", { column: 2 });
    expect(next.meta?.memoryMatch?.faceUp).toEqual([2]);
    expect(next.meta?.memoryMatch?.pendingMismatch).toBe(false);
  });

  it("moves a Quoridor pawn toward the goal", () => {
    const state = createGameState("quoridor");
    const result = applyGameMove(state, "p1", { row: 7, column: 4 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.meta?.quoridor?.pawns.p1).toEqual({ row: 7, column: 4 });
    expect(result.state.turn).toBe("p2");
  });

  it("rolls Dice Duel through shared moves", () => {
    const state = createGameState("dice-duel");
    const result = applyGameMove(state, "p1", { column: 0, action: "roll" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.meta?.diceDuel?.lastRoll?.dice.length).toBeGreaterThan(0);
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

  it("chooses a Checkers capture instead of a quiet move", () => {
    const state = createGameState("checkers");
    state.board = Array.from({ length: 8 }, () => Array.from<Cell>({ length: 8 }).fill(null));
    state.board[5][0] = "p1";
    state.board[4][1] = "p2";
    state.board[5][4] = "p1";

    expect(chooseBotMove(state, "p1", "ruthless")).toEqual({ row: 5, column: 0, toRow: 3, toColumn: 2 });
  });

  it("targets adjacent water after a Sea Battle hit", () => {
    const state = createGameState("battleship");
    state.turn = "p2";
    state.meta!.battleship!.botShots = { "4,4": "hit" };

    const move = chooseBotMove(state, "p2", "ruthless");

    expect([
      { row: 3, column: 4 },
      { row: 5, column: 4 },
      { row: 4, column: 3 },
      { row: 4, column: 5 }
    ]).toContainEqual(move);
  });

  it("extends a Sea Battle hit line instead of guessing beside the middle", () => {
    const state = createGameState("battleship");
    state.turn = "p2";
    setDefendingBattleshipFleet(state, {
      id: "battleship",
      name: "Battleship",
      size: 4,
      orientation: "horizontal",
      cells: [
        { row: 4, column: 3 },
        { row: 4, column: 4 },
        { row: 4, column: 5 },
        { row: 4, column: 6 }
      ]
    });
    state.meta!.battleship!.botShots = { "4,4": "hit", "4,5": "hit" };

    expect([
      { row: 4, column: 3 },
      { row: 4, column: 6 }
    ]).toContainEqual(chooseBotMove(state, "p2", "ruthless"));
  });

  it("extends the open end of a Sea Battle hit line when the other end missed", () => {
    const state = createGameState("battleship");
    state.turn = "p2";
    setDefendingBattleshipFleet(state, {
      id: "cruiser",
      name: "Cruiser",
      size: 3,
      orientation: "horizontal",
      cells: [
        { row: 4, column: 4 },
        { row: 4, column: 5 },
        { row: 4, column: 6 }
      ]
    });
    state.meta!.battleship!.botShots = {
      "4,3": "miss",
      "4,4": "hit",
      "4,5": "hit"
    };

    expect(chooseBotMove(state, "p2", "ruthless")).toEqual({ row: 4, column: 6 });
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
