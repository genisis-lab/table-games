import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Cell } from "../shared/games";
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
        onSwitchGame={vi.fn()}
        onSetBoardVariant={onSetBoardVariant}
        onSetBotDifficulty={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "5x5 board" }));
    expect(onSetBoardVariant).toHaveBeenCalledWith("wide");
  });
});
