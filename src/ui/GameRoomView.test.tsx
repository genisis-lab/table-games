import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Cell } from "../shared/games";
import type { AppliedMove } from "../shared/protocol";
import type { RoomSnapshot } from "../shared/protocol";
import { advanceSnakeRun, createFlappyRun, createSnakeRun, GameRoomView, queueSnakeTurn } from "./GameRoomView";

const room: RoomSnapshot = {
  roomId: "room-test",
  gameId: "four-in-a-row",
  boardVariant: "classic",
  opponent: "friend",
  botDifficulty: "ruthless",
  botStarts: false,
  players: [
    {
      guestToken: "red-token",
      name: "Ruby",
      mark: "p1",
      connected: true,
      joinedAt: 1
    },
    {
      guestToken: "yellow-token",
      name: "Sunny",
      mark: "p2",
      connected: true,
      joinedAt: 2
    }
  ],
  spectators: [],
  board: Array.from({ length: 6 }, () => Array.from<Cell>({ length: 7 }).fill(null)),
  turn: "p1",
  winner: null,
  winningLine: [],
  moveCount: 0,
  chat: [
    {
      id: "chat-1",
      guestToken: "red-token",
      name: "Ruby",
      body: "your move",
      at: 1
    }
  ],
  reactionEvents: [
    {
      id: "reaction-1",
      guestToken: "yellow-token",
      name: "Sunny",
      emoji: "🔥",
      at: 3
    }
  ],
  moveHistory: [],
  rematchRequests: [],
  undoRequests: [],
  createdAt: 1,
  updatedAt: 3
};

describe("GameRoomView", () => {
  it("renders invite, chat, reaction controls, and sends board/chat/reaction actions", () => {
    const onMove = vi.fn();
    const onChat = vi.fn();
    const onReaction = vi.fn();
    const onRematch = vi.fn();
    const onSwitchGame = vi.fn();

    render(
      <GameRoomView
        room={room}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={onMove}
        onChat={onChat}
        onReaction={onReaction}
        onRematch={onRematch}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={onSwitchGame}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByText("https://table-sparks.test/room/room-test")).toBeInTheDocument();
    expect(screen.getByText("your move")).toBeInTheDocument();

    const board = screen.getByLabelText("Four in a Row board");
    fireEvent.click(within(board).getByRole("button", { name: /column 1/i }));
    expect(onMove).toHaveBeenCalledWith({ column: 0 });

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "that drop was loud" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send chat" }));
    expect(onChat).toHaveBeenCalledWith("that drop was loud");

    fireEvent.click(screen.getByRole("button", { name: "React with 😂" }));
    expect(onReaction).toHaveBeenCalledWith("😂");
    expect(screen.getAllByText("🔥").length).toBeGreaterThan(1);
  });

  it("renders the rebuilt Domino table and sends selected legal-end moves", () => {
    const onMove = vi.fn();
    const dominoRoom: RoomSnapshot = {
      ...room,
      gameId: "dominoes",
      board: [[null]],
      players: [
        { guestToken: "red-token", name: "Ruby", mark: "p1", connected: true, joinedAt: 1 },
        { guestToken: "bot-2", name: "Bot 2", mark: "p2", connected: true, joinedAt: 2, isBot: true },
        { guestToken: "bot-3", name: "Bot 3", mark: "p3", connected: true, joinedAt: 3, isBot: true },
        { guestToken: "bot-4", name: "Bot 4", mark: "p4", connected: true, joinedAt: 4, isBot: true }
      ],
      meta: {
        dominoes: {
          deck: [],
          hands: {
            p1: [{ id: "2-4", left: 2, right: 4 }, { id: "1-1", left: 1, right: 1 }],
            p2: [],
            p3: [],
            p4: []
          },
          handCounts: { p1: 2, p2: 7, p3: 7, p4: 7 },
          chain: [{ id: "4-6", left: 4, right: 6, owner: "p2", roundIndex: 0 }],
          openLeft: 4,
          openRight: 6,
          scores: { p1: 0, p2: 0, p3: 0, p4: 0 },
          pipCounts: { p1: 8, p2: 0, p3: 0, p4: 0 },
          teamScores: { northSouth: 0, eastWest: 0 },
          passed: [],
          passedNumbers: { p1: [], p2: [], p3: [], p4: [] },
          playerOrder: ["p1", "p2", "p3", "p4"],
          round: 1,
          targetScore: 100,
          gameMode: "partnership",
          drawMode: "block",
          log: ["Seat 2 played 4-6"],
          lastAction: "Seat 2 played 4-6"
        }
      }
    };

    render(
      <GameRoomView
        room={dominoRoom}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={onMove}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select 2-4" }));
    fireEvent.click(screen.getByRole("button", { name: /left 4/i }));

    expect(onMove).toHaveBeenCalledWith({ column: 0, edge: "h" });
    expect(screen.getByText(/team 1 \+ 3/i)).toBeInTheDocument();
    expect(screen.getByText(/2 tiles · 8 pips/i)).toBeInTheDocument();
  });

  it("keeps spectator reactions locked until the game is over", () => {
    const onReaction = vi.fn();
    const spectatorRoom: RoomSnapshot = {
      ...room,
      spectators: [
        { guestToken: "watch-token", name: "Wally", connected: true, joinedAt: 4 }
      ]
    };
    const { rerender } = render(
      <GameRoomView
        room={spectatorRoom}
        guestToken="watch-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={onReaction}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    const reactionButton = screen.getByRole("button", { name: "React with 😂" });
    expect(reactionButton).toBeDisabled();
    fireEvent.click(reactionButton);
    expect(onReaction).not.toHaveBeenCalled();

    rerender(
      <GameRoomView
        room={{ ...spectatorRoom, winner: "p1" }}
        guestToken="watch-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={onReaction}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    const unlockedButton = screen.getByRole("button", { name: "React with 😂" });
    expect(unlockedButton).not.toBeDisabled();
    fireEvent.click(unlockedButton);
    expect(onReaction).toHaveBeenCalledWith("😂");
  });

  it("disables board moves when it is not the current player's turn", () => {
    const onMove = vi.fn();
    render(
      <GameRoomView
        room={{ ...room, turn: "p2" }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={onMove}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /column 1/i }));
    expect(onMove).not.toHaveBeenCalled();
  });

  it("shows reconnecting as a quiet status chip", () => {
    render(
      <GameRoomView
        room={room}
        guestToken="red-token"
        connectionStatus="reconnecting"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByText("Reconnecting...")).toHaveClass("connection-reconnecting");
  });

  it("shows when a friend opponent is briefly reconnecting", () => {
    render(
      <GameRoomView
        room={{
          ...room,
          players: [
            room.players[0],
            { ...room.players[1], connected: false }
          ]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByText("Opponent reconnecting")).toBeInTheDocument();
    expect(screen.getByText("reconnecting")).toBeInTheDocument();
  });

  it("shows bot mode controls for bot rooms", () => {
    const onSetBotDifficulty = vi.fn();
    render(
      <GameRoomView
        room={{
          ...room,
          opponent: "bot",
          players: [
            room.players[0],
            { ...room.players[1], name: "Spark Bot", isBot: true }
          ]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={onSetBotDifficulty}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /sharp bot/i }));
    expect(onSetBotDifficulty).toHaveBeenCalledWith("sharp");
  });

  it("offers larger board-rule variants for Tic Tac Toe-style games", () => {
    const onSetBoardVariant = vi.fn();
    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "tic-tac-toe",
          board: Array.from({ length: 3 }, () => Array.from<Cell>({ length: 3 }).fill(null))
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={onSetBoardVariant}
        onSetBotDifficulty={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "5x5 board" }));
    expect(onSetBoardVariant).toHaveBeenCalledWith("wide");
  });

  it("keeps game and board settings available to the host after the first move", () => {
    const onSetBoardVariant = vi.fn();
    const onSwitchGame = vi.fn();
    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "tic-tac-toe",
          board: [
            ["p1", null, null],
            [null, null, null],
            [null, null, null]
          ],
          moveCount: 1
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={onSwitchGame}
        onSetBoardVariant={onSetBoardVariant}
        onSetBotDifficulty={vi.fn()}
      />
    );

    const wideButton = screen.getByRole("button", { name: "5x5 board" });
    expect(wideButton).not.toBeDisabled();
    fireEvent.click(wideButton);
    expect(onSetBoardVariant).toHaveBeenCalledWith("wide");

    const gomokuRailButton = screen.getByRole("button", { name: "Gomoku" });
    expect(gomokuRailButton).not.toBeDisabled();
    fireEvent.click(gomokuRailButton);
    expect(onSwitchGame).toHaveBeenCalledWith("gomoku");
  });

  it("marks the most recent Tic Tac Toe move so it can animate without resizing the grid", () => {
    const lastMove: AppliedMove = {
      row: 1,
      column: 1,
      player: "p1",
      at: 9
    };

    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "tic-tac-toe",
          board: [
            [null, null, null],
            [null, "p1", null],
            [null, null, null]
          ]
        }}
        guestToken="yellow-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        lastMove={lastMove}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /row 2, column 2/i })).toHaveClass("last-move");
  });

  it("renders a solo Flappy Bird table without friend-only controls", () => {
    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "flappy-bird",
          opponent: "bot",
          players: [room.players[0]],
          board: [[null]]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByRole("application", { name: "Flappy Bird" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start run" })).toBeInTheDocument();
    expect(screen.queryByText("Bot mode")).not.toBeInTheDocument();
  });

  it("renders Snake and 2048 as solo arcade tables", () => {
    const { rerender } = render(
      <GameRoomView
        room={{
          ...room,
          gameId: "snake",
          opponent: "bot",
          players: [room.players[0]],
          board: [[null]]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByRole("application", { name: "Snake" })).toBeInTheDocument();
    expect(screen.queryByText("Bot mode")).not.toBeInTheDocument();

    rerender(
      <GameRoomView
        room={{
          ...room,
          gameId: "twenty-forty-eight",
          opponent: "bot",
          players: [room.players[0]],
          board: [[null]]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByRole("group", { name: "2048 board" })).toBeInTheDocument();
    expect(screen.queryByText("Bot mode")).not.toBeInTheDocument();
  });

  it("renders Uno with a private hand and sends play or draw moves", () => {
    const onMove = vi.fn();
    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "last-card",
          opponent: "bot",
          players: [
            room.players[0],
            { ...room.players[1], name: "Spark Bot", isBot: true }
          ],
          board: [[null]],
          meta: {
            lastCard: {
              deck: [],
              deckCount: 25,
              discard: [{ id: "red-5-table", color: "red", rank: "5" }],
              hands: {
                p1: [
                  { id: "red-7-a", color: "red", rank: "7" },
                  { id: "green-2-a", color: "green", rank: "2" }
                ],
                p2: [],
                p3: [],
                p4: []
              },
              handCounts: { p1: 2, p2: 7, p3: 0, p4: 0 },
              currentColor: "red"
            }
          }
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={onMove}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByRole("group", { name: "Uno table" })).toBeInTheDocument();
    expect(screen.getByText("7 cards")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play red 7" }));
    expect(onMove).toHaveBeenCalledWith({ column: 0 });

    expect(screen.getByRole("button", { name: "Play green 2" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Draw a card" }));
    expect(onMove).toHaveBeenCalledWith({ column: -1 });
  });

  it("starts Flappy Bird only from the start button while ready", () => {
    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "flappy-bird",
          opponent: "bot",
          players: [room.players[0]],
          board: [[null]]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    const game = screen.getByRole("application", { name: "Flappy Bird" });
    fireEvent.pointerDown(game);
    expect(game).toHaveClass("ready");
    expect(screen.getByRole("button", { name: "Start run" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: " " });
    expect(game).toHaveClass("ready");

    fireEvent.click(screen.getByRole("button", { name: "Start run" }));
    expect(game).toHaveClass("playing");
    expect(screen.queryByRole("button", { name: "Start run" })).not.toBeInTheDocument();
  });

  it("lets desktop players flap Flappy Bird with the space key without focusing the game", () => {
    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "flappy-bird",
          opponent: "bot",
          players: [room.players[0]],
          board: [[null]]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Start run" }));
    const allowed = fireEvent.keyDown(window, { key: " ", cancelable: true });

    expect(screen.getByRole("application", { name: "Flappy Bird" })).toHaveClass("playing");
    expect(allowed).toBe(false);
  });

  it("installs a non-passive document touch listener for mobile Flappy taps", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");

    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "flappy-bird",
          opponent: "bot",
          players: [room.players[0]],
          board: [[null]]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    const hasDocumentTouchListener = addEventListener.mock.calls.some(([type, , options]) =>
      type === "touchstart" &&
      typeof options === "object" &&
      options !== null &&
      "capture" in options &&
      options.capture === true &&
      "passive" in options &&
      options.passive === false
    );

    expect(hasDocumentTouchListener).toBe(true);

    addEventListener.mockRestore();
  });

  it("accepts active Flappy taps even when mobile reports the page body as the target", () => {
    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "flappy-bird",
          opponent: "bot",
          players: [room.players[0]],
          board: [[null]]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Start run" }));
    const tap = new Event("touchstart", { bubbles: true, cancelable: true });

    expect(document.body.dispatchEvent(tap)).toBe(false);
    expect(tap.defaultPrevented).toBe(true);
    expect(screen.queryByRole("button", { name: "Flap" })).not.toBeInTheDocument();
  });

  it("creates a fresh random Flappy pipe for each new run", () => {
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.8);

    const firstRun = createFlappyRun(4);
    const secondRun = createFlappyRun(4);

    expect(firstRun.best).toBe(4);
    expect(secondRun.pipes[0].gapTop).not.toBe(firstRun.pipes[0].gapTop);
    random.mockRestore();
  });

  it("starts Flappy Bird with a forgiving first pipe distance", () => {
    const firstRun = createFlappyRun(0, "playing");

    expect(firstRun.pipes[0].x).toBeGreaterThanOrEqual(570);
  });

  it("renders Flappy Bird inside a transform motion track", () => {
    const { container } = render(
      <GameRoomView
        room={{
          ...room,
          gameId: "flappy-bird",
          opponent: "bot",
          players: [room.players[0]],
          board: [[null]]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(container.querySelector(".flappy-bird-track")).toBeInTheDocument();
    expect(container.querySelector(".flappy-bird-track .flappy-bird-sprite")).toBeInTheDocument();
  });

  it("queues quick Snake turns so mobile swipes do not feel dropped", () => {
    const queued = queueSnakeTurn(queueSnakeTurn(createSnakeRun(0, "playing"), "up"), "left");

    const firstStep = advanceSnakeRun(queued);
    expect(firstStep.direction).toBe("up");
    expect(firstStep.snake[0]).toEqual({ row: 6, column: 6 });

    const secondStep = advanceSnakeRun(firstStep);
    expect(secondStep.direction).toBe("left");
    expect(secondStep.snake[0]).toEqual({ row: 6, column: 5 });
  });

  it("renders a larger thumb pad for Snake mobile control", () => {
    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "snake",
          opponent: "bot",
          players: [room.players[0]],
          board: [[null]]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByRole("group", { name: "Snake thumb pad" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move up" })).toHaveClass("pad-up");
  });

  it("highlights nearly completed Dots and Boxes squares as the real scoring target", () => {
    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "dots-and-boxes",
          board: Array.from({ length: 4 }, () => Array.from<Cell>({ length: 4 }).fill(null)),
          meta: {
            dots: {
              size: 4,
              hEdges: [
                [true, false, false, false],
                [true, false, false, false],
                [false, false, false, false],
                [false, false, false, false],
                [false, false, false, false]
              ],
              vEdges: [
                [true, false, false, false, false],
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, false, false, false, false]
              ],
              scores: { p1: 0, p2: 0, p3: 0, p4: 0 }
            }
          }
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Box 1, 1 open with 3 sides")).toHaveClass("almost");
  });

  it("reveals sunk Battleship ship art after every cell in that ship is hit", () => {
    const shipCells = [
      { row: 1, column: 1 },
      { row: 1, column: 2 }
    ];

    render(
      <GameRoomView
        room={{
          ...room,
          gameId: "battleship",
          opponent: "bot",
          players: [
            room.players[0],
            { ...room.players[1], name: "Spark Bot", isBot: true }
          ],
          board: Array.from({ length: 10 }, () => Array.from<Cell>({ length: 10 }).fill(null)),
          meta: {
            battleship: {
              botFleet: [
                {
                  id: "patrol",
                  name: "Patrol Boat",
                  size: 2,
                  orientation: "horizontal",
                  cells: shipCells
                }
              ],
              playerFleet: [],
              botShips: shipCells,
              playerShips: [],
              humanShots: {
                "1,1": "hit",
                "1,2": "hit"
              },
              botShots: {}
            }
          }
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByRole("img", { name: "Sunk Patrol Boat" })).toHaveStyle({
      gridRow: "2 / span 1",
      gridColumn: "2 / span 2"
    });
  });

  it("shows rules and move history without live undo controls", () => {
    render(
      <GameRoomView
        room={{
          ...room,
          board: room.board.map((row, rowIndex) =>
            row.map((cell, columnIndex) => rowIndex === 5 && columnIndex === 0 ? "p1" : cell)
          ),
          moveHistory: [
            { id: "move-1", player: "p1", name: "Ruby", label: "Column 1", at: 5 }
          ],
          undoRequests: ["red-token"]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByText("Connect four pieces horizontally, vertically, or diagonally.")).toBeInTheDocument();
    expect(screen.getByText("Column 1")).toBeInTheDocument();
    expect(screen.queryByText("Undo requested 1/2")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request undo" })).not.toBeInTheDocument();
  });

  it("shows game-over celebration and rematch vote count", () => {
    render(
      <GameRoomView
        room={{
          ...room,
          winner: "p1",
          rematchRequests: ["red-token"]
        }}
        guestToken="red-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getAllByText("Red wins")).toHaveLength(2);
    expect(screen.getByText("Rematch vote 1/2")).toBeInTheDocument();
  });

  it("lets spectators claim an open seat", () => {
    const onClaimSeat = vi.fn();
    render(
      <GameRoomView
        room={{
          ...room,
          players: [
            room.players[0],
            { ...room.players[1], connected: false }
          ],
          spectators: [
            { guestToken: "watch-token", name: "Wally", connected: true, joinedAt: 4 }
          ]
        }}
        guestToken="watch-token"
        connectionStatus="connected"
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={vi.fn()}
        onClaimSeat={onClaimSeat}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByText("Spectators")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take open seat" }));
    expect(onClaimSeat).toHaveBeenCalled();
  });
});
