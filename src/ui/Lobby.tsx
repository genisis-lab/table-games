import { Bot, ChevronRight, Link2, MessageCircle, Sparkles, UsersRound } from "lucide-react";
import type { BotDifficulty, GameId } from "../shared/games";
import { GAME_IDS, getGameDefinition } from "../shared/games";

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
                      aria-label={`Play ${definition.name} against bot`}
                    >
                      <Bot size={18} />
                      Bot
                    </button>
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
  return "Classic black and white stones on a wooden 15x15 grid.";
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
