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
            Quick 1v1 board-game rooms with invite links, live chat, and ridiculous reaction
            storms.
          </p>
          <div className="feature-row">
            <span><UsersRound size={18} /> Guest seats</span>
            <span><Link2 size={18} /> Copy invite</span>
            <span><Sparkles size={18} /> Screen-filling reactions</span>
          </div>
        </div>

        <div className="game-stack" aria-label="Choose a game">
          {GAME_IDS.map((gameId) => {
            const definition = getGameDefinition(gameId);
            return (
              <article className={`game-poster ${gameId}`} key={gameId}>
                <GamePreview gameId={gameId} />
                <div>
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
