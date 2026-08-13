import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Lobby } from "./Lobby";

describe("Lobby", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the complete shelf and starts bot or friend rooms, including Chess and Set Trio", async () => {
    const onCreateRoom = vi.fn().mockResolvedValue(true);
    render(<Lobby onCreateRoom={onCreateRoom} creatingGameId={null} />);

    expect(screen.getByRole("heading", { name: "Table Games" })).toBeInTheDocument();
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
    expect(screen.getByText("Chess")).toBeInTheDocument();
    expect(screen.getByText("Set Trio")).toBeInTheDocument();

    const fourCard = screen.getByRole("article", { name: /four in a row game card/i });
    fireEvent.click(within(fourCard).getByRole("button", { name: /play four in a row against bot/i }));
    await waitFor(() => expect(onCreateRoom).toHaveBeenCalledWith("four-in-a-row", {
        opponent: "bot",
        botDifficulty: "ruthless"
      }));

    fireEvent.click(within(fourCard).getByRole("button", { name: /invite friend to four in a row/i }));
    await waitFor(() => expect(onCreateRoom).toHaveBeenCalledWith("four-in-a-row", {
        opponent: "friend",
        botDifficulty: "ruthless"
      }));

    const ticCard = screen.getByRole("article", { name: /^tic tac toe game card$/i });
    expect(within(ticCard).queryByRole("button", { name: /tic tac toe 5x5/i })).not.toBeInTheDocument();
    expect(within(ticCard).queryByRole("button", { name: /tic tac toe sharp bot/i })).not.toBeInTheDocument();
    fireEvent.click(within(ticCard).getByRole("button", { name: /play tic tac toe against bot/i }));
    await waitFor(() => expect(onCreateRoom).toHaveBeenCalledWith("tic-tac-toe", {
        opponent: "bot",
        botDifficulty: "ruthless"
      }));

    const flappyCard = screen.getByRole("article", { name: /pipe dash game card/i });
    fireEvent.click(within(flappyCard).getByRole("button", { name: /play pipe dash solo/i }));
    await waitFor(() => expect(onCreateRoom).toHaveBeenCalledWith("flappy-bird", {
        opponent: "bot",
        botDifficulty: "ruthless"
      }));

    const dominoCard = screen.getByRole("article", { name: /dominoes game card/i });
    fireEvent.click(within(dominoCard).getByRole("button", { name: /play dominoes against bot/i }));
    await waitFor(() => expect(onCreateRoom).toHaveBeenCalledWith("dominoes", {
        opponent: "bot",
        botDifficulty: "ruthless"
      }));
    fireEvent.click(within(dominoCard).getByRole("button", { name: /invite friend to dominoes/i }));
    await waitFor(() => expect(onCreateRoom).toHaveBeenCalledWith("dominoes", {
        opponent: "friend",
        botDifficulty: "ruthless"
      }));

    const lastCard = screen.getByRole("article", { name: /color clash game card/i });
    fireEvent.click(within(lastCard).getByRole("button", { name: /invite friend to color clash/i }));
    await waitFor(() => expect(onCreateRoom).toHaveBeenCalledWith("last-card", {
        opponent: "friend",
        botDifficulty: "ruthless"
      }));

    const chessCard = screen.getByRole("article", { name: /chess game card/i });
    fireEvent.click(within(chessCard).getByRole("button", { name: /invite friend to chess/i }));
    await waitFor(() => expect(onCreateRoom).toHaveBeenCalledWith("chess", {
        opponent: "friend",
        botDifficulty: "ruthless"
      }));

    const setCard = screen.getByRole("article", { name: /set trio game card/i });
    fireEvent.click(within(setCard).getByRole("button", { name: /play set trio against bot/i }));
    await waitFor(() => expect(onCreateRoom).toHaveBeenCalledWith("set-trio", {
        opponent: "bot",
        botDifficulty: "ruthless"
      }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("table-games-recent-v1") ?? "[]")[0]?.gameId).toBe("set-trio"));

    fireEvent.click(screen.getByRole("button", { name: "Arcade" }));
    expect(screen.queryByRole("article", { name: /four in a row game card/i })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: /pipe dash game card/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search games"), { target: { value: "word" } });
    expect(screen.getByRole("article", { name: /word hunt game card/i })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /pipe dash game card/i })).not.toBeInTheDocument();
  });

  it("persists favorites and records recent play only after a successful room creation", async () => {
    const onCreateRoom = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(undefined);
    render(<Lobby onCreateRoom={onCreateRoom} creatingGameId={null} />);

    fireEvent.click(screen.getByRole("button", { name: /add chess to favorites/i }));
    expect(JSON.parse(localStorage.getItem("table-games-favorites-v1") ?? "[]")).toEqual(["chess"]);

    fireEvent.click(screen.getByRole("button", { name: /play chess against bot/i }));
    await waitFor(() => expect(onCreateRoom).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem("table-games-recent-v1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /invite friend to chess/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /play again/i })).toHaveTextContent("Chess"));
    expect(JSON.parse(localStorage.getItem("table-games-recent-v1") ?? "[]")).toEqual([
      { gameId: "chess", opponent: "friend" }
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(screen.getByRole("article", { name: /chess game card/i })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /set trio game card/i })).not.toBeInTheDocument();
  });
});
