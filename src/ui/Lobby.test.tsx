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
    expect(screen.getByText("Pipe Dash")).toBeInTheDocument();
    expect(screen.queryByText("Snake")).not.toBeInTheDocument();
    expect(screen.getByText("2048")).toBeInTheDocument();
    expect(screen.getByText("Color Clash")).toBeInTheDocument();
    expect(screen.getByText("Darts")).toBeInTheDocument();
    expect(screen.getByText("Word Hunt")).toBeInTheDocument();
    expect(screen.getByText("Cup Pong")).toBeInTheDocument();
    expect(screen.getByText("Dominoes")).toBeInTheDocument();

    const fourCard = screen.getByRole("article", { name: /four in a row game card/i });
    fireEvent.click(within(fourCard).getByRole("button", { name: /play four in a row against bot/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("four-in-a-row", {
      opponent: "bot",
      botDifficulty: "ruthless"
    });

    fireEvent.click(within(fourCard).getByRole("button", { name: /invite friend to four in a row/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("four-in-a-row", {
      opponent: "friend",
      botDifficulty: "ruthless"
    });

    const ticCard = screen.getByRole("article", { name: /^tic tac toe game card$/i });
    expect(within(ticCard).queryByRole("button", { name: /tic tac toe 5x5/i })).not.toBeInTheDocument();
    expect(within(ticCard).queryByRole("button", { name: /tic tac toe sharp bot/i })).not.toBeInTheDocument();
    fireEvent.click(within(ticCard).getByRole("button", { name: /play tic tac toe against bot/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("tic-tac-toe", {
      opponent: "bot",
      botDifficulty: "ruthless"
    });

    const flappyCard = screen.getByRole("article", { name: /pipe dash game card/i });
    fireEvent.click(within(flappyCard).getByRole("button", { name: /play pipe dash solo/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("flappy-bird", {
      opponent: "bot",
      botDifficulty: "ruthless"
    });

    const dominoCard = screen.getByRole("article", { name: /dominoes game card/i });
    fireEvent.click(within(dominoCard).getByRole("button", { name: /play dominoes against bot/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("dominoes", {
      opponent: "bot",
      botDifficulty: "ruthless"
    });
    fireEvent.click(within(dominoCard).getByRole("button", { name: /invite friend to dominoes/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("dominoes", {
      opponent: "friend",
      botDifficulty: "ruthless"
    });

    const lastCard = screen.getByRole("article", { name: /color clash game card/i });
    fireEvent.click(within(lastCard).getByRole("button", { name: /invite friend to color clash/i }));
    expect(onCreateRoom).toHaveBeenCalledWith("last-card", {
      opponent: "friend",
      botDifficulty: "ruthless"
    });

    fireEvent.click(screen.getByRole("tab", { name: "Arcade" }));
    expect(screen.queryByRole("article", { name: /four in a row game card/i })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: /pipe dash game card/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search games"), { target: { value: "word" } });
    expect(screen.getByRole("article", { name: /word hunt game card/i })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /pipe dash game card/i })).not.toBeInTheDocument();
  });
});
