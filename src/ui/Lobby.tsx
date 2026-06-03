import { Bot, ChevronRight, Link2, MessageCircle, Search, Sparkles, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { BoardVariant, BotDifficulty, GameId } from "../shared/games";
import { GAME_IDS, getBoardVariantOptions, getGameDefinition, isSoloGame, supportsFriendMode } from "../shared/games";

interface LobbyProps {
  onCreateRoom: (
    gameId: GameId,
    options: { opponent: "friend" | "bot"; botDifficulty: BotDifficulty; boardVariant?: BoardVariant }
  ) => void;
  creatingGameId: GameId | null;
}

type LibraryCategory = "All" | "Classic" | "Strategy" | "Arcade" | "Solo";
type GameMode = "bot" | "friend" | "solo";

interface GamePickerOptions {
  mode: GameMode;
  botDifficulty: BotDifficulty;
  boardVariant?: BoardVariant;
}

const LIBRARY_CATEGORIES: LibraryCategory[] = ["All", "Classic", "Strategy", "Arcade", "Solo"];
const BOT_DIFFICULTIES: BotDifficulty[] = ["casual", "sharp", "ruthless"];

const CATEGORY_GAMES: Record<Exclude<LibraryCategory, "All">, GameId[]> = {
  Classic: [
    "four-in-a-row",
    "tic-tac-toe",
    "gomoku",
    "dots-and-boxes",
    "checkers",
    "battleship",
    "mancala",
    "last-card"
  ],
  Strategy: [
    "ultimate-tic-tac-toe",
    "reversi",
    "gomoku",
    "hex",
    "nine-mens-morris",
    "checkers",
    "mancala",
    "last-card"
  ],
  Arcade: ["flappy-bird", "snake", "twenty-forty-eight"],
  Solo: ["flappy-bird", "snake", "twenty-forty-eight"]
};

export function Lobby({ onCreateRoom, creatingGameId }: LobbyProps) {
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>("All");
  const [query, setQuery] = useState("");
  const [optionsByGame, setOptionsByGame] = useState<Partial<Record<GameId, GamePickerOptions>>>({});

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

  const updateOptions = (gameId: GameId, patch: Partial<GamePickerOptions>) => {
    setOptionsByGame((current) => ({
      ...current,
      [gameId]: {
        ...defaultOptionsFor(gameId),
        ...current[gameId],
        ...patch
      }
    }));
  };

  const startGame = (gameId: GameId) => {
    const options = { ...defaultOptionsFor(gameId), ...optionsByGame[gameId] };
    onCreateRoom(gameId, {
      opponent: options.mode === "friend" ? "friend" : "bot",
      botDifficulty: options.botDifficulty,
      boardVariant: options.boardVariant
    });
  };

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
              const option = { ...defaultOptionsFor(gameId), ...optionsByGame[gameId] };
              const modes = modesFor(gameId);
              const boardOptions = getBoardVariantOptions(gameId);
              const startLabel = option.mode === "friend"
                ? "Invite friend"
                : option.mode === "solo"
                  ? "Solo run"
                  : "Play bot";
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
                  <div className="poster-options">
                    {modes.length > 1 ? (
                      <div className="option-row" aria-label={`${definition.name} play mode`}>
                        {modes.map((mode) => (
                          <button
                            className={option.mode === mode ? "option-chip active" : "option-chip"}
                            type="button"
                            aria-label={`${definition.name} ${modeLabel(mode)}`}
                            onClick={() => updateOptions(gameId, { mode })}
                            key={mode}
                          >
                            {modeLabel(mode)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {boardOptions.length > 1 ? (
                      <div className="option-row" aria-label={`${definition.name} board size`}>
                        {boardOptions.map((boardOption) => (
                          <button
                            className={option.boardVariant === boardOption.id ? "option-chip active" : "option-chip"}
                            type="button"
                            aria-label={`${definition.name} ${boardOption.label}`}
                            title={boardOption.detail}
                            onClick={() => updateOptions(gameId, { boardVariant: boardOption.id })}
                            key={boardOption.id}
                          >
                            {boardOption.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {option.mode === "bot" && !isSoloGame(gameId) ? (
                      <div className="option-row" aria-label={`${definition.name} bot intelligence`}>
                        {BOT_DIFFICULTIES.map((difficulty) => (
                          <button
                            className={option.botDifficulty === difficulty ? "option-chip active" : "option-chip"}
                            type="button"
                            aria-label={`${definition.name} ${difficulty} bot`}
                            onClick={() => updateOptions(gameId, { botDifficulty: difficulty })}
                            key={difficulty}
                          >
                            {difficultyLabel(difficulty)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="poster-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => startGame(gameId)}
                      disabled={creatingGameId === gameId}
                      aria-label={`Start ${definition.name} ${option.mode === "friend" ? "friend room" : option.mode === "solo" ? "solo run" : "bot room"}`}
                    >
                      {option.mode === "friend" ? <UsersRound size={18} /> : <Bot size={18} />}
                      {startLabel}
                    </button>
                    <ChevronRight className="poster-arrow" size={18} aria-hidden="true" />
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

function defaultOptionsFor(gameId: GameId): GamePickerOptions {
  return {
    mode: isSoloGame(gameId) ? "solo" : "bot",
    botDifficulty: "ruthless",
    boardVariant: getBoardVariantOptions(gameId)[0]?.id
  };
}

function modesFor(gameId: GameId): GameMode[] {
  if (isSoloGame(gameId)) return ["solo"];
  if (supportsFriendMode(gameId)) return ["bot", "friend"];
  return ["bot"];
}

function badgesFor(gameId: GameId): string[] {
  if (isSoloGame(gameId)) return ["Solo"];
  const badges = supportsFriendMode(gameId) ? ["1v1", "Bot supported"] : ["Bot supported"];
  if (gameId === "battleship") badges.unshift("Solo captain");
  return badges;
}

function modeLabel(mode: GameMode): string {
  if (mode === "friend") return "Friend";
  if (mode === "solo") return "Solo";
  return "Bot";
}

function difficultyLabel(difficulty: BotDifficulty): string {
  if (difficulty === "casual") return "Casual";
  if (difficulty === "sharp") return "Sharp";
  return "Ruthless";
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
