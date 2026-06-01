import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Cell } from "../shared/games";
import type { AppliedMove } from "../shared/protocol";
import type { RoomSnapshot } from "../shared/protocol";
import { GameRoomView } from "./GameRoomView";

const room: RoomSnapshot = {
  roomId: "room-test",
  gameId: "four-in-a-row",
  boardVariant: "classic",
  opponent: "friend",
  botDifficulty: "ruthless",
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

  it("disables board moves when it is not the current player's turn", () => {
    const onMove = vi.fn();
    render(
      <GameRoomView
        room={{ ...room, turn: "p2" }}
        guestToken="red-token"
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
              scores: { p1: 0, p2: 0 }
            }
          }
        }}
        guestToken="red-token"
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

  it("shows rules, move history, and undo requests", () => {
    const onRequestUndo = vi.fn();
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
        inviteUrl="https://table-sparks.test/room/room-test"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        onMove={vi.fn()}
        onChat={vi.fn()}
        onReaction={vi.fn()}
        onRematch={vi.fn()}
        onRequestUndo={onRequestUndo}
        onClaimSeat={vi.fn()}
        onSwitchGame={vi.fn()}
        onSetBoardVariant={vi.fn()}
        onSetBotDifficulty={vi.fn()}
      />
    );

    expect(screen.getByText("Connect four pieces horizontally, vertically, or diagonally.")).toBeInTheDocument();
    expect(screen.getByText("Column 1")).toBeInTheDocument();
    expect(screen.getByText("Undo requested 1/2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Request undo" }));
    expect(onRequestUndo).toHaveBeenCalled();
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
