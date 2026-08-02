import { Bot, ChevronRight, Link2, MessageCircle, Search, Sparkles, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { BoardVariant, BotDifficulty, GameId } from "../shared/games";
import { GAME_IDS, getGameDefinition, isSoloGame, supportsFriendMode } from "../shared/games";

interface LobbyProps {
  onCreateRoom: (
    gameId: GameId,
    options: { opponent: "friend" | "bot"; botDifficulty: BotDifficulty; boardVariant?: BoardVariant }
  ) => void;
  creatingGameId: GameId | null;
}

type LibraryCategory = "All" | "Classic" | "Strategy" | "Arcade" | "Solo";

const LIBRARY_CATEGORIES: LibraryCategory[] = ["All", "Classic", "Strategy", "Arcade", "Solo"];

const CATEGORY_GAMES: Record<Exclude<LibraryCategory, "All">, GameId[]> = {
  Classic: [
    "four-in-a-row",
    "tic-tac-toe",
    "gomoku",
    "dots-and-boxes",
    "checkers",
    "battleship",
    "mancala",
    "last-card",
    "darts",
    "cup-pong",
    "dominoes",
    "memory-match",
    "dice-duel"
  ],
  Strategy: [
    "ultimate-tic-tac-toe",
    "reversi",
    "gomoku",
    "hex",
    "nine-mens-morris",
    "checkers",
    "mancala",
    "last-card",
    "word-hunt",
    "dominoes",
    "order-and-chaos",
    "quoridor"
  ],
  Arcade: ["flappy-bird", "cup-pong", "darts", "word-hunt", "dice-duel", "twenty-forty-eight"],
  Solo: ["flappy-bird", "twenty-forty-eight"]
};

export function Lobby({ onCreateRoom, creatingGameId }: LobbyProps) {
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>("All");
  const [query, setQuery] = useState("");

  const visibleGameIds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return GAME_IDS.filter((gameId) => {
      const inCategory = activeCategory === "All" || CATEGORY_GAMES[activeCategory].includes(gameId);
      if (!inCategory) return false;
      if (!needle) return true;
      const definition = getGameDefinition(gameId);
      return `${definition.name} ${descriptionFor(gameId)} ${badgesFor(gameId).join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
  }, [activeCategory, query]);

  return (
    <main className="lobby-shell">
      <header className="lobby-topbar">
        <div className="brand-lockup">
          <span className="brand-mark">TG</span>
          <span>Table Games</span>
        </div>
        <div className="topbar-actions" aria-label="Room features">
          <span><Link2 size={16} /> Invites</span>
          <span><MessageCircle size={16} /> Live chat</span>
          <span><Sparkles size={16} /> Reactions</span>
        </div>
      </header>

      <section className="lobby-stage" aria-labelledby="lobby-title">
        <div className="lobby-copy">
          <h1 id="lobby-title">Table Games</h1>
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
            <div>
              <span>{visibleGameIds.length}/{GAME_IDS.length} tables live</span>
              <strong>Game shelf</strong>
            </div>
            <label className="game-search">
              <Search size={17} />
              <input
                aria-label="Search games"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
              />
            </label>
          </div>
          <div className="game-category-tabs" role="tablist" aria-label="Game categories">
            {LIBRARY_CATEGORIES.map((category) => (
              <button
                className={activeCategory === category ? "category-tab active" : "category-tab"}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                onClick={() => setActiveCategory(category)}
                key={category}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="game-stack">
            {visibleGameIds.map((gameId) => {
              const definition = getGameDefinition(gameId);
              return (
                <article className={`game-poster ${gameId}`} aria-label={`${definition.name} game card`} key={gameId}>
                  <GamePreview gameId={gameId} />
                  <div className="game-copy">
                    <h2>{definition.name}</h2>
                    <div className="game-badges" aria-label={`${definition.name} supports`}>
                      {badgesFor(gameId).map((badge) => (
                        <span className="game-badge" key={badge}>{badge}</span>
                      ))}
                    </div>
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

function badgesFor(gameId: GameId): string[] {
  if (isSoloGame(gameId)) return ["Solo"];
  const badges = supportsFriendMode(gameId) ? ["1v1", "Bot supported"] : ["Bot supported"];
  if (gameId === "battleship") badges.unshift("Solo captain");
  if (gameId === "dominoes") badges.unshift("4 seats");
  return badges;
}

function descriptionFor(gameId: GameId): string {
  if (gameId === "four-in-a-row") return "Gravity drops, red versus yellow, loud little wins.";
  if (gameId === "tic-tac-toe") return "Marker-grid duels for fast revenge rounds.";
  if (gameId === "gomoku") return "Classic black and white stones on a wooden 15x15 grid.";
  if (gameId === "ultimate-tic-tac-toe") return "Nine tiny grids that keep sending the next move somewhere spicy.";
  if (gameId === "dots-and-boxes") return "Draw the last line, claim the box, keep the turn.";
  if (gameId === "reversi") return "Flip whole rows of discs and watch the table change sides.";
  if (gameId === "checkers") return "Diagonal jumps, kings, and clean classic board energy.";
  if (gameId === "battleship") return "Bot-only sea combat with splashy misses and nasty hits.";
  if (gameId === "mancala") return "Sow stones around the table and steal from the opposite pit.";
  if (gameId === "hex") return "Build an unbroken bridge across a sharp little hex board.";
  if (gameId === "last-card") return "Color-card shedding with skips, reverses, wilds, and draw cards.";
  if (gameId === "darts") return "Throw for 301 or 501 on a bright pub dartboard.";
  if (gameId === "word-hunt") return "Timed letter-grid races where every connected word you spot adds to your score.";
  if (gameId === "cup-pong") return "Clear the rack cup by cup with a clean table-top bounce feel.";
  if (gameId === "dominoes") return "A four-seat double-six table with bots ready to fill empty chairs.";
  if (gameId === "order-and-chaos") return "One player builds a five-mark line while the other tries to make the board beautifully messy.";
  if (gameId === "memory-match") return "Flip cards, remember symbols, and chain extra turns when you find pairs.";
  if (gameId === "quoridor") return "Race your pawn across the maze while dropping walls that still leave a path.";
  if (gameId === "dice-duel") return "A press-your-luck dice race: roll the pot higher or bank before the one appears.";
  if (gameId === "flappy-bird") return "A crisp little pipe-dodging sky run with random gaps and instant restarts.";
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
        <span className="card wild">+4</span>
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

  if (gameId === "darts") {
    return (
      <div className="mini-darts" aria-hidden="true">
        <span />
        <span />
        <span />
        <strong>50</strong>
      </div>
    );
  }

  if (gameId === "word-hunt") {
    return (
      <div className="mini-word" aria-hidden="true">
        {"SPARKTABLEBOARDXX".split("").slice(0, 16).map((letter, index) => (
          <span key={index}>{letter}</span>
        ))}
      </div>
    );
  }

  if (gameId === "cup-pong") {
    return (
      <div className="mini-cup-pong" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, index) => <span key={index} />)}
        <strong />
      </div>
    );
  }

  if (gameId === "dominoes") {
    return (
      <div className="mini-dominoes" aria-hidden="true">
        {[[6, 6], [6, 4], [4, 2], [2, 5]].map(([left, right], index) => (
          <span key={index}><b>{left}</b><b>{right}</b></span>
        ))}
      </div>
    );
  }

  if (gameId === "order-and-chaos") {
    return (
      <div className="mini-order-chaos" aria-hidden="true">
        {"XOXXOOXOXOOXXOXO".split("").map((mark, index) => <span key={index}>{mark}</span>)}
      </div>
    );
  }

  if (gameId === "memory-match") {
    return (
      <div className="mini-memory" aria-hidden="true">
        {["★", "?", "◆", "?", "★", "●", "?", "◆"].map((mark, index) => <span key={index}>{mark}</span>)}
      </div>
    );
  }

  if (gameId === "quoridor") {
    return (
      <div className="mini-quoridor" aria-hidden="true">
        {Array.from({ length: 25 }).map((_, index) => (
          <span className={index === 2 ? "north" : index === 22 ? "south" : index === 7 || index === 12 || index === 17 ? "wall" : ""} key={index} />
        ))}
      </div>
    );
  }

  if (gameId === "dice-duel") {
    return (
      <div className="mini-dice-duel" aria-hidden="true">
        <span>5</span>
        <span>2</span>
        <strong>+7</strong>
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
