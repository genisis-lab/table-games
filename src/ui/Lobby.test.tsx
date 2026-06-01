import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Lobby } from "./Lobby";

describe("Lobby", () => {
  it("shows all v1 games and starts a bot or friend room for the selected game", () => {
    const onCreateRoom = vi.fn();
    render(<Lobby onCreateRoom={onCreateRoom} creatingGameId={null} />);

    expect(screen.getByRole("heading", { name: "Table Sparks" })).toBeInTheDocument();
    expect(screen.getByText("Four in a Row")).toBeInTheDocument();
    expect(screen.getByText("Tic Tac Toe")).toBeInTheDocument();
    expect(screen.getByText("Gomoku")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /play four in a row against bot/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("four-in-a-row", {
      opponent: "bot",
      botDifficulty: "ruthless"
    });

    fireEvent.click(screen.getByRole("button", { name: /invite friend to four in a row/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("four-in-a-row", {
      opponent: "friend",
      botDifficulty: "ruthless"
    });
  });
});
