import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByText("Flappy Bird")).toBeInTheDocument();
    expect(screen.getByText("Snake")).toBeInTheDocument();
    expect(screen.getByText("2048")).toBeInTheDocument();
    expect(screen.getByText("Last Card")).toBeInTheDocument();

    const fourCard = screen.getByRole("article", { name: /four in a row game card/i });
    fireEvent.click(within(fourCard).getByRole("button", { name: /start four in a row bot room/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("four-in-a-row", {
      opponent: "bot",
      botDifficulty: "ruthless",
      boardVariant: "classic"
    });

    fireEvent.click(within(fourCard).getByRole("button", { name: /four in a row friend/i }));
    fireEvent.click(within(fourCard).getByRole("button", { name: /start four in a row friend room/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("four-in-a-row", {
      opponent: "friend",
      botDifficulty: "ruthless",
      boardVariant: "classic"
    });

    const ticCard = screen.getByRole("article", { name: /^tic tac toe game card$/i });
    fireEvent.click(within(ticCard).getByRole("button", { name: /tic tac toe 5x5/i }));
    fireEvent.click(within(ticCard).getByRole("button", { name: /tic tac toe sharp bot/i }));
    fireEvent.click(within(ticCard).getByRole("button", { name: /start tic tac toe bot room/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("tic-tac-toe", {
      opponent: "bot",
      botDifficulty: "sharp",
      boardVariant: "wide"
    });

    const flappyCard = screen.getByRole("article", { name: /flappy bird game card/i });
    fireEvent.click(within(flappyCard).getByRole("button", { name: /start flappy bird solo run/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("flappy-bird", {
      opponent: "bot",
      botDifficulty: "ruthless",
      boardVariant: "classic"
    });

    const snakeCard = screen.getByRole("article", { name: /snake game card/i });
    fireEvent.click(within(snakeCard).getByRole("button", { name: /start snake solo run/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("snake", {
      opponent: "bot",
      botDifficulty: "ruthless",
      boardVariant: "classic"
    });
    expect(within(snakeCard).queryByRole("button", { name: /snake friend/i })).not.toBeInTheDocument();

    const lastCard = screen.getByRole("article", { name: /last card game card/i });
    fireEvent.click(within(lastCard).getByRole("button", { name: /last card friend/i }));
    fireEvent.click(within(lastCard).getByRole("button", { name: /start last card friend room/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("last-card", {
      opponent: "friend",
      botDifficulty: "ruthless",
      boardVariant: "classic"
    });

    fireEvent.click(screen.getByRole("tab", { name: "Arcade" }));
    expect(screen.queryByRole("article", { name: /four in a row game card/i })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: /flappy bird game card/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search games"), { target: { value: "snake" } });
    expect(screen.getByRole("article", { name: /snake game card/i })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /flappy bird game card/i })).not.toBeInTheDocument();
  });
});
