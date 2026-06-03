import { Bot, ChevronRight, Link2, MessageCircle, Sparkles, UsersRound } from "lucide-react";
import type { BotDifficulty, GameId } from "../shared/games";
import { GAME_IDS, getGameDefinition, isSoloGame, supportsFriendMode } from "../shared/games";

interface LobbyProps {
  onCreateRoom: (
    gameId: GameId,
    options: { opponent: "friend" | "bot"; botDifficulty: BotDifficulty }
  ) => void;
  creatingGameId: GameId | null;
}

export function Lobby({ onCreateRoom, creatingGameId }: LobbyProps) {
  return (
    <main className="lobby-shell">
      <header className="lobby-topbar">
        <div className="brand-lockup">
          <span className="brand-mark">TS</span>
          <span>Table Sparks</span>
        </div>
        <div className="topbar-actions" aria-label="Room features">
          <span><Link2 size={16} /> Invites</span>
          <span><MessageCircle size={16} /> Live chat</span>
          <span><Sparkles size={16} /> Reactions</span>
        </div>
      </header>

      <section className="lobby-stage" aria-labelledby="lobby-title">
        <div className="lobby-copy">
          <h1 id="lobby-title">Table Sparks</h1>
          <p>
            Board-game tables for quick bot duels or invite-link friend matches, with chat and
            reaction storms baked in.
          </p>
          <div className="feature-row">
            <span><Bot size={18} /> Smart bots</span>
            <span><UsersRound size={18} /> Friend seats</span>
            <span><Sparkles size={18} /> Reaction bursts</span>
          </div>
        </div>

        <section className="game-library" aria-label="Choose a game">
          <div className="library-heading">
            <span>{GAME_IDS.length} tables live</span>
            <strong>Game shelf</strong>
          </div>
          <div className="game-stack">
            {GAME_IDS.map((gameId) => {
              const definition = getGameDefinition(gameId);
              return (
                <article className={`game-poster ${gameId}`} key={gameId}>
                  <GamePreview gameId={gameId} />
                  <div className="game-copy">
                    <h2>{definition.name}</h2>
                    <p>{descriptionFor(gameId)}</p>
                  </div>
                  <div className="poster-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => onCreateRoom(gameId, {
                        opponent: "bot",
                        botDifficulty: "ruthless"
                      })}
                      disabled={creatingGameId === gameId}
                      aria-label={isSoloGame(gameId) ? `Play ${definition.name} solo` : `Play ${definition.name} against bot`}
                    >
                      <Bot size={18} />
                      {isSoloGame(gameId) ? "Solo" : "Bot"}
                    </button>
                    {supportsFriendMode(gameId) ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => onCreateRoom(gameId, {
                          opponent: "friend",
                          botDifficulty: "ruthless"
                        })}
                        disabled={creatingGameId === gameId}
                        aria-label={`Invite friend to ${definition.name}`}
                      >
                        Friend
                        <ChevronRight size={18} />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

function descriptionFor(gameId: GameId): string {
  if (gameId === "four-in-a-row") return "Gravity drops, red versus yellow, loud little wins.";
  if (gameId === "tic-tac-toe") return "Marker-grid duels for fast revenge rounds.";
  if (gameId === "gomoku") return "Classic black and white stones on a wooden 15x15 grid.";
  if (gameId === "ultimate-tic-tac-toe") return "Nine tiny grids that keep sending the next move somewhere spicy.";
  if (gameId === "dots-and-boxes") return "Draw the last line, claim the box, keep the turn.";
  if (gameId === "reversi") return "Flip whole rows of discs and watch the table change sides.";
  if (gameId === "checkers") return "Diagonal jumps, kings, and clean classic board energy.";
  if (gameId === "battleship") return "Bot-only fleet hunting with splashy misses and nasty hits.";
  if (gameId === "mancala") return "Sow stones around the table and steal from the opposite pit.";
  if (gameId === "hex") return "Build an unbroken bridge across a sharp little hex board.";
  if (gameId === "last-card") return "A color-matching card race with skip, reverse, and draw-two trouble.";
  if (gameId === "flappy-bird") return "A crisp little sky run with random pipes and instant restarts.";
  if (gameId === "snake") return "A fast little chase for food, clean turns, and just-one-more runs.";
  if (gameId === "twenty-forty-eight") return "Slide chunky number tiles into bigger and bigger sparks.";
  return "Place, slide, make mills, and knock pieces off the board.";
}

function GamePreview({ gameId }: { gameId: GameId }) {
  if (gameId === "four-in-a-row") {
    return (
      <div className="mini-connect" aria-hidden="true">
        {Array.from({ length: 42 }).map((_, index) => (
          <span
            className={index > 29 ? (index % 2 === 0 ? "red" : "yellow") : ""}
            key={index}
          />
        ))}
      </div>
    );
  }

  if (gameId === "tic-tac-toe") {
    return (
      <div className="mini-tic" aria-hidden="true">
        <span>X</span><span /><span>O</span>
        <span /><span>X</span><span />
        <span>O</span><span /><span>X</span>
      </div>
    );
  }

  if (gameId === "gomoku") {
    return (
      <div className="mini-gomoku" aria-hidden="true">
        {Array.from({ length: 49 }).map((_, index) => (
          <span
            className={index === 17 || index === 25 || index === 33 ? "black" : index === 18 || index === 26 ? "white" : ""}
            key={index}
          />
        ))}
      </div>
    );
  }

  if (gameId === "ultimate-tic-tac-toe") {
    return (
      <div className="mini-ultimate" aria-hidden="true">
        {Array.from({ length: 81 }).map((_, index) => (
          <span className={index % 10 === 0 ? "x" : index % 8 === 0 ? "o" : ""} key={index} />
        ))}
      </div>
    );
  }

  if (gameId === "dots-and-boxes") {
    return (
      <div className="mini-dots" aria-hidden="true">
        {Array.from({ length: 25 }).map((_, index) => <span className={index % 2 === 0 ? "line" : ""} key={index} />)}
      </div>
    );
  }

  if (gameId === "mancala") {
    return (
      <div className="mini-mancala" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, index) => <span key={index}>4</span>)}
      </div>
    );
  }

  if (gameId === "battleship") {
    return (
      <div className="mini-battleship" aria-hidden="true">
        {Array.from({ length: 49 }).map((_, index) => <span className={index === 9 || index === 16 || index === 23 ? "hit" : index === 30 ? "miss" : ""} key={index} />)}
      </div>
    );
  }

  if (gameId === "checkers") {
    return (
      <div className="mini-checkers" aria-hidden="true">
        {Array.from({ length: 64 }).map((_, index) => <span className={index % 2 ? (index < 24 ? "black" : index > 39 ? "red" : "") : ""} key={index} />)}
      </div>
    );
  }

  if (gameId === "hex") {
    return (
      <div className="mini-hex" aria-hidden="true">
        {Array.from({ length: 49 }).map((_, index) => <span className={index % 8 === 0 ? "p1" : index % 6 === 0 ? "p2" : ""} key={index} />)}
      </div>
    );
  }

  if (gameId === "last-card") {
    return (
      <div className="mini-last-card" aria-hidden="true">
        <span className="card red">7</span>
        <span className="card yellow">S</span>
        <span className="card green">+2</span>
        <span className="card blue">R</span>
      </div>
    );
  }

  if (gameId === "flappy-bird") {
    return (
      <div className="mini-flappy" aria-hidden="true">
        <span className="mini-bird" />
        <span className="mini-pipe top" />
        <span className="mini-pipe bottom" />
        <span className="mini-ground" />
      </div>
    );
  }

  if (gameId === "snake") {
    return (
      <div className="mini-snake" aria-hidden="true">
        {Array.from({ length: 64 }).map((_, index) => (
          <span className={index === 18 ? "food" : index >= 34 && index <= 38 ? "body" : ""} key={index} />
        ))}
      </div>
    );
  }

  if (gameId === "twenty-forty-eight") {
    return (
      <div className="mini-twenty" aria-hidden="true">
        {[2, 4, 0, 8, 0, 16, 32, 0, 4, 0, 64, 128, 0, 256, 0, 512].map((value, index) => (
          <span className={value ? "filled" : ""} key={index}>{value || ""}</span>
        ))}
      </div>
    );
  }

  return (
    <div className="mini-gomoku" aria-hidden="true">
      {Array.from({ length: 49 }).map((_, index) => (
        <span
          className={index === 0 || index === 3 || index === 6 ? "white" : index === 8 || index === 10 ? "black" : ""}
          key={index}
        />
      ))}
    </div>
  );
}
