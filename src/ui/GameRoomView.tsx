import {
  Bot,
  Copy,
  Home,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  UsersRound
} from "lucide-react";
import { type CSSProperties, type FormEvent, useMemo, useState } from "react";
import type { BoardPoint, BotDifficulty, BoardVariant, GameId, GameMove, PlayerMark } from "../shared/games";
import { GAME_IDS, getBoardVariantOptions, getGameDefinition } from "../shared/games";
import { REACTIONS, type RoomSnapshot } from "../shared/protocol";

interface GameRoomViewProps {
  room: RoomSnapshot;
  guestToken: string;
  inviteUrl: string;
  copiedInvite: boolean;
  onCopyInvite: () => void;
  onMove: (move: GameMove) => void;
  onChat: (body: string) => void;
  onReaction: (emoji: string) => void;
  onRematch: () => void;
  onSwitchGame: (gameId: GameId) => void;
  onSetBoardVariant: (variant: BoardVariant) => void;
  onSetBotDifficulty: (difficulty: BotDifficulty) => void;
}

export function GameRoomView({
  room,
  guestToken,
  inviteUrl,
  copiedInvite,
  onCopyInvite,
  onMove,
  onChat,
  onReaction,
  onRematch,
  onSwitchGame,
  onSetBoardVariant,
  onSetBotDifficulty
}: GameRoomViewProps) {
  const [message, setMessage] = useState("");
  const definition = getGameDefinition(room.gameId);
  const boardVariantOptions = getBoardVariantOptions(room.gameId);
  const currentPlayer = room.players.find((player) => player.guestToken === guestToken);
  const currentTurnPlayer = room.players.find((player) => player.mark === room.turn);
  const canMove = Boolean(currentPlayer && currentPlayer.mark === room.turn && !room.winner);
  const status = room.winner
    ? room.winner === "draw"
      ? "Draw table"
      : `${definition.playerNames[room.winner]} wins`
    : currentTurnPlayer?.isBot
      ? `${currentTurnPlayer.name} thinking`
    : `${definition.playerNames[room.turn]} to move`;

  const submitChat = (event: FormEvent) => {
    event.preventDefault();
    const clean = message.trim();
    if (!clean) return;
    onChat(clean);
    setMessage("");
  };

  return (
    <main className="room-shell">
      <ReactionLayer reactions={room.reactionEvents} />

      <aside className="game-rail" aria-label="Games">
        <a className="home-button" href="/" aria-label="Lobby">
          <Home size={18} />
        </a>
        <div className="rail-brand">
          <span className="brand-mark">TS</span>
          <span>Table Sparks</span>
        </div>
        <div className="rail-games">
          {GAME_IDS.map((gameId) => (
            <button
              className={gameId === room.gameId ? "rail-game active" : "rail-game"}
              type="button"
              onClick={() => onSwitchGame(gameId)}
              key={gameId}
            >
              <span className={`rail-icon ${gameId}`} aria-hidden="true" />
              <span>{getGameDefinition(gameId).name}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="play-column">
        <header className="room-topbar">
          <div>
            <p>{room.roomId}</p>
            <h1>{definition.name}</h1>
          </div>
          <div className="status-chip">{status}</div>
          <button className="icon-text-button" type="button" onClick={onRematch}>
            <RotateCcw size={18} />
            Rematch
          </button>
        </header>

        {boardVariantOptions.length > 1 ? (
          <section className="board-size-toolbar" aria-label="Board size">
            {boardVariantOptions.map((option) => (
              <button
                className={room.boardVariant === option.id ? "mode-button active" : "mode-button"}
                type="button"
                aria-label={`${option.label} board`}
                title={option.detail}
                onClick={() => onSetBoardVariant(option.id)}
                key={option.id}
              >
                {option.label}
              </button>
            ))}
          </section>
        ) : null}

        <section className={`board-stage ${room.gameId} variant-${room.boardVariant}`}>
          <Board room={room} canMove={canMove} currentMark={currentPlayer?.mark} onMove={onMove} />
        </section>

        <section className="reaction-dock" aria-label="Reactions">
          <span><Sparkles size={16} /> React</span>
          {REACTIONS.map((emoji) => (
            <button
              type="button"
              className="reaction-button"
              aria-label={`React with ${emoji}`}
              onClick={() => onReaction(emoji)}
              key={emoji}
            >
              {emoji}
            </button>
          ))}
        </section>
      </section>

      <aside className="chat-panel">
        <section className="invite-strip" aria-label="Invite">
          <div>
            <p>Invite link</p>
            <strong>{inviteUrl}</strong>
          </div>
          <button className="icon-button" type="button" onClick={onCopyInvite} aria-label="Copy Invite">
            <Copy size={18} />
          </button>
          {copiedInvite ? <span className="copied-note">Copied</span> : null}
        </section>

        <section className="players-strip" aria-label="Players">
          <div className="section-title"><UsersRound size={16} /> Players</div>
          {room.players.map((player) => (
            <div className={`player-row ${player.mark}`} key={player.guestToken}>
              <span className="player-piece" />
              <span>{player.name}</span>
              <small>{player.isBot ? "bot" : player.connected ? "live" : "away"}</small>
            </div>
          ))}
          {currentPlayer ? <p className="seat-note">You are {definition.playerNames[currentPlayer.mark]}.</p> : null}
        </section>

        {room.opponent === "bot" ? (
          <section className="bot-strip" aria-label="Bot mode">
            <div className="section-title"><Bot size={16} /> Bot mode</div>
            <div className="bot-modes">
              {(["casual", "sharp", "ruthless"] as const).map((difficulty) => (
                <button
                  className={room.botDifficulty === difficulty ? "mode-button active" : "mode-button"}
                  type="button"
                  aria-label={`${difficulty} bot`}
                  onClick={() => onSetBotDifficulty(difficulty)}
                  key={difficulty}
                >
                  {modeLabel(difficulty)}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="chat-log" aria-label="Live chat">
          <div className="section-title"><MessageCircle size={16} /> Live chat</div>
          <div className="chat-messages">
            {room.chat.map((chat) => (
              <article className="chat-bubble" key={chat.id}>
                <strong>{chat.name}</strong>
                <span>{chat.body}</span>
              </article>
            ))}
          </div>
          <form className="chat-form" onSubmit={submitChat}>
            <label htmlFor="message-input">Message</label>
            <input
              id="message-input"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="gg incoming"
              maxLength={180}
            />
            <button className="icon-button send-button" type="submit" aria-label="Send chat">
              <Send size={18} />
            </button>
          </form>
        </section>
      </aside>
    </main>
  );
}

function Board({
  room,
  canMove,
  currentMark,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  currentMark?: PlayerMark;
  onMove: (move: GameMove) => void;
}) {
  if (room.gameId === "four-in-a-row") {
    return <FourInARowBoard room={room} canMove={canMove} onMove={onMove} />;
  }

  if (room.gameId === "tic-tac-toe") {
    return <TicTacToeBoard room={room} canMove={canMove} onMove={onMove} />;
  }

  if (room.gameId === "gomoku") {
    return <GomokuBoard room={room} canMove={canMove} onMove={onMove} />;
  }

  if (room.gameId === "ultimate-tic-tac-toe") {
    return <UltimateTicTacToeBoard room={room} canMove={canMove} onMove={onMove} />;
  }

  if (room.gameId === "dots-and-boxes") {
    return <DotsAndBoxesBoard room={room} canMove={canMove} onMove={onMove} />;
  }

  if (room.gameId === "reversi") {
    return <GridStoneBoard room={room} canMove={canMove} onMove={onMove} label="Reversi board" className="reversi-board" />;
  }

  if (room.gameId === "checkers") {
    return <CheckersBoard room={room} canMove={canMove} currentMark={currentMark} onMove={onMove} />;
  }

  if (room.gameId === "battleship") {
    return <BattleshipBoard room={room} canMove={canMove} onMove={onMove} />;
  }

  if (room.gameId === "mancala") {
    return <MancalaBoard room={room} canMove={canMove} currentMark={currentMark} onMove={onMove} />;
  }

  if (room.gameId === "hex") {
    return <GridStoneBoard room={room} canMove={canMove} onMove={onMove} label="Hex board" className="hex-board" />;
  }

  return <MorrisBoard room={room} canMove={canMove} currentMark={currentMark} onMove={onMove} />;
}

function FourInARowBoard({
  room,
  canMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  onMove: (move: GameMove) => void;
}) {
  return (
    <div
      className="connect-board"
      role="group"
      aria-label="Four in a Row board"
      style={{ "--columns": 7 } as CSSProperties}
    >
      {Array.from({ length: 7 }).map((_, columnIndex) => (
        <button
          className="connect-column"
          type="button"
          aria-label={`Column ${columnIndex + 1}`}
          disabled={!canMove || Boolean(room.board[0][columnIndex])}
          onClick={() => onMove({ column: columnIndex })}
          key={columnIndex}
        >
          {room.board.map((row, rowIndex) => {
            const cell = row[columnIndex];
            return (
              <span
                className={`connect-slot ${cell ?? ""} ${isWinning(room, rowIndex, columnIndex) ? "win" : ""}`}
                key={`${rowIndex}-${columnIndex}`}
              >
                <span />
              </span>
            );
          })}
        </button>
      ))}
    </div>
  );
}

function TicTacToeBoard({
  room,
  canMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  onMove: (move: GameMove) => void;
}) {
  return (
    <div
      className="tic-board"
      role="group"
      aria-label="Tic Tac Toe board"
      style={{ "--board-columns": room.board[0].length } as CSSProperties}
    >
      {room.board.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => (
          <button
            className={isWinning(room, rowIndex, columnIndex) ? "win" : ""}
            type="button"
            aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
            disabled={!canMove || Boolean(cell)}
            onClick={() => onMove({ row: rowIndex, column: columnIndex })}
            key={`${rowIndex}-${columnIndex}`}
          >
            {cell ? (cell === "p1" ? "X" : "O") : ""}
          </button>
        ))
      )}
    </div>
  );
}

function GomokuBoard({
  room,
  canMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  onMove: (move: GameMove) => void;
}) {
  return (
    <div className="gomoku-board" role="group" aria-label="Gomoku board">
      {room.board.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => (
          <button
            className={`${cell ?? ""} ${isWinning(room, rowIndex, columnIndex) ? "win" : ""}`}
            type="button"
            aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
            disabled={!canMove || Boolean(cell)}
            onClick={() => onMove({ row: rowIndex, column: columnIndex })}
            key={`${rowIndex}-${columnIndex}`}
          >
            <span />
          </button>
        ))
      )}
    </div>
  );
}

function UltimateTicTacToeBoard({
  room,
  canMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  onMove: (move: GameMove) => void;
}) {
  const activeBoard = room.meta?.ultimate?.activeBoard ?? null;
  const localWinners = room.meta?.ultimate?.localWinners ?? [];
  const localSize = Math.sqrt(room.board.length);
  return (
    <div
      className="ultimate-board"
      role="group"
      aria-label="Ultimate Tic Tac Toe board"
      style={{ "--board-columns": room.board[0].length, "--local-size": localSize } as CSSProperties}
    >
      {room.board.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => {
          const mini = Math.floor(rowIndex / localSize) * localSize + Math.floor(columnIndex / localSize);
          const playable = activeBoard === null || activeBoard === mini;
          const claimed = Boolean(localWinners[mini]);
          return (
            <button
              className={`${isWinning(room, rowIndex, columnIndex) ? "win" : ""} ${playable ? "active-mini" : ""} ${claimed ? "claimed-mini" : ""}`}
              type="button"
              aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
              disabled={!canMove || Boolean(cell) || !playable || claimed}
              onClick={() => onMove({ row: rowIndex, column: columnIndex })}
              key={`${rowIndex}-${columnIndex}`}
            >
              {cell ? (cell === "p1" ? "X" : "O") : ""}
            </button>
          );
        })
      )}
    </div>
  );
}

function DotsAndBoxesBoard({
  room,
  canMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  onMove: (move: GameMove) => void;
}) {
  const dots = room.meta?.dots;
  if (!dots) return null;
  const gridSize = dots.size * 2 + 1;
  const items = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      if (row % 2 === 0 && column % 2 === 0) {
        items.push(<span className="dot-node" key={`${row}-${column}`} />);
      } else if (row % 2 === 0) {
        const edgeRow = row / 2;
        const edgeColumn = Math.floor(column / 2);
        const drawn = dots.hEdges[edgeRow]?.[edgeColumn];
        items.push(
          <button
            className={drawn ? "dot-edge horizontal drawn" : "dot-edge horizontal"}
            type="button"
            aria-label={`Horizontal line ${edgeRow + 1}, ${edgeColumn + 1}`}
            disabled={!canMove || drawn}
            onClick={() => onMove({ edge: "h", row: edgeRow, column: edgeColumn })}
            key={`${row}-${column}`}
          />
        );
      } else if (column % 2 === 0) {
        const edgeRow = Math.floor(row / 2);
        const edgeColumn = column / 2;
        const drawn = dots.vEdges[edgeRow]?.[edgeColumn];
        items.push(
          <button
            className={drawn ? "dot-edge vertical drawn" : "dot-edge vertical"}
            type="button"
            aria-label={`Vertical line ${edgeRow + 1}, ${edgeColumn + 1}`}
            disabled={!canMove || drawn}
            onClick={() => onMove({ edge: "v", row: edgeRow, column: edgeColumn })}
            key={`${row}-${column}`}
          />
        );
      } else {
        const box = room.board[Math.floor(row / 2)]?.[Math.floor(column / 2)];
        items.push(<span className={`dot-box ${box ?? ""}`} key={`${row}-${column}`} />);
      }
    }
  }

  return (
    <div className="dots-wrap">
      <div className="dots-score">
        <span>Blue {dots.scores.p1}</span>
        <span>Red {dots.scores.p2}</span>
      </div>
      <div
        className="dots-board"
        role="group"
        aria-label="Dots and Boxes board"
        style={{ "--dots-grid": gridSize } as CSSProperties}
      >
        {items}
      </div>
    </div>
  );
}

function GridStoneBoard({
  room,
  canMove,
  onMove,
  label,
  className
}: {
  room: RoomSnapshot;
  canMove: boolean;
  onMove: (move: GameMove) => void;
  label: string;
  className: string;
}) {
  return (
    <div className={className} role="group" aria-label={label}>
      {room.board.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => (
          <button
            className={`${cell ?? ""} ${isWinning(room, rowIndex, columnIndex) ? "win" : ""}`}
            type="button"
            aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
            disabled={!canMove || Boolean(cell)}
            onClick={() => onMove({ row: rowIndex, column: columnIndex })}
            key={`${rowIndex}-${columnIndex}`}
          >
            <span />
          </button>
        ))
      )}
    </div>
  );
}

function CheckersBoard({
  room,
  canMove,
  currentMark,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  currentMark?: PlayerMark;
  onMove: (move: GameMove) => void;
}) {
  const [selected, setSelected] = useState<BoardPoint | null>(null);
  const kings = new Set(room.meta?.checkers?.kings ?? []);

  return (
    <div className="checkers-board" role="group" aria-label="Checkers board">
      {room.board.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => {
          const dark = (rowIndex + columnIndex) % 2 === 1;
          const isSelected = selected?.row === rowIndex && selected.column === columnIndex;
          return (
            <button
              className={`${dark ? "dark" : "light"} ${cell ?? ""} ${isSelected ? "selected" : ""} ${kings.has(`${rowIndex},${columnIndex}`) ? "king" : ""}`}
              type="button"
              aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
              disabled={!canMove || !dark}
              onClick={() => {
                if (cell === currentMark) {
                  setSelected({ row: rowIndex, column: columnIndex });
                  return;
                }
                if (selected) {
                  onMove({ row: selected.row, column: selected.column, toRow: rowIndex, toColumn: columnIndex });
                  setSelected(null);
                }
              }}
              key={`${rowIndex}-${columnIndex}`}
            >
              {cell ? <span /> : null}
            </button>
          );
        })
      )}
    </div>
  );
}

function BattleshipBoard({
  room,
  canMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  onMove: (move: GameMove) => void;
}) {
  const shots = room.meta?.battleship?.humanShots ?? {};
  const botShots = room.meta?.battleship?.botShots ?? {};
  return (
    <div className="battleship-wrap">
      <div className="fleet-status">
        <span>Your hits {Object.values(shots).filter((shot) => shot === "hit").length}</span>
        <span>Incoming {Object.keys(botShots).length}</span>
      </div>
      <div className="battleship-board" role="group" aria-label="Battleship target board">
        {room.board.flatMap((row, rowIndex) =>
          row.map((_, columnIndex) => {
            const shot = shots[`${rowIndex},${columnIndex}`];
            return (
              <button
                className={shot ?? ""}
                type="button"
                aria-label={`Fire row ${rowIndex + 1}, column ${columnIndex + 1}`}
                disabled={!canMove || Boolean(shot)}
                onClick={() => onMove({ row: rowIndex, column: columnIndex })}
                key={`${rowIndex}-${columnIndex}`}
              >
                {shot === "hit" ? "X" : shot === "miss" ? "•" : ""}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function MancalaBoard({
  room,
  canMove,
  currentMark,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  currentMark?: PlayerMark;
  onMove: (move: GameMove) => void;
}) {
  const mancala = room.meta?.mancala;
  if (!mancala) return null;
  return (
    <div className="mancala-board" role="group" aria-label="Mancala board">
      <div className="mancala-store p2">{mancala.stores.p2}</div>
      <div className="mancala-pits top">
        {[...mancala.pits.p2].reverse().map((stones, index) => {
          const column = 5 - index;
          return (
            <button
              type="button"
              disabled={!canMove || currentMark !== "p2" || stones === 0}
              onClick={() => onMove({ column })}
              key={column}
            >
              {stones}
            </button>
          );
        })}
      </div>
      <div className="mancala-pits bottom">
        {mancala.pits.p1.map((stones, column) => (
          <button
            type="button"
            disabled={!canMove || currentMark !== "p1" || stones === 0}
            onClick={() => onMove({ column })}
            key={column}
          >
            {stones}
          </button>
        ))}
      </div>
      <div className="mancala-store p1">{mancala.stores.p1}</div>
    </div>
  );
}

function MorrisBoard({
  room,
  canMove,
  currentMark,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  currentMark?: PlayerMark;
  onMove: (move: GameMove) => void;
}) {
  const [selected, setSelected] = useState<BoardPoint | null>(null);
  const points = new Set([
    "0,0", "0,3", "0,6", "1,1", "1,3", "1,5", "2,2", "2,3", "2,4",
    "3,0", "3,1", "3,2", "3,4", "3,5", "3,6", "4,2", "4,3", "4,4",
    "5,1", "5,3", "5,5", "6,0", "6,3", "6,6"
  ]);

  return (
    <div className="morris-board" role="group" aria-label="Nine Men's Morris board">
      {room.board.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => {
          const key = `${rowIndex},${columnIndex}`;
          const playable = points.has(key);
          const isSelected = selected?.row === rowIndex && selected.column === columnIndex;
          return (
            <button
              className={`${playable ? "point" : "blank"} ${cell ?? ""} ${isSelected ? "selected" : ""}`}
              type="button"
              aria-label={`Point ${rowIndex + 1}, ${columnIndex + 1}`}
              disabled={!canMove || !playable}
              onClick={() => {
                if (cell === currentMark) {
                  setSelected({ row: rowIndex, column: columnIndex });
                  return;
                }
                if (selected) {
                  onMove({ row: selected.row, column: selected.column, toRow: rowIndex, toColumn: columnIndex });
                  setSelected(null);
                  return;
                }
                onMove({ row: rowIndex, column: columnIndex });
              }}
              key={key}
            >
              {cell ? <span /> : null}
            </button>
          );
        })
      )}
    </div>
  );
}

function ReactionLayer({ reactions }: { reactions: RoomSnapshot["reactionEvents"] }) {
  const bursts = useMemo(
    () =>
      reactions.slice(-8).flatMap((reaction, reactionIndex) =>
        Array.from({ length: 10 }).map((_, burstIndex) => ({
          ...reaction,
          key: `${reaction.id}-${burstIndex}`,
          size: 22 + ((burstIndex + reactionIndex) % 5) * 13,
          left: (burstIndex * 17 + reactionIndex * 11) % 96,
          top: (burstIndex * 23 + reactionIndex * 7) % 88,
          delay: burstIndex * 0.035
        }))
      ),
    [reactions]
  );

  return (
    <div className="reaction-layer" aria-hidden="true">
      {bursts.map((burst) => (
        <span
          className="reaction-burst"
          style={{
            left: `${burst.left}%`,
            top: `${burst.top}%`,
            fontSize: `${burst.size}px`,
            animationDelay: `${burst.delay}s`
          }}
          key={burst.key}
        >
          {burst.emoji}
        </span>
      ))}
    </div>
  );
}

function isWinning(room: RoomSnapshot, row: number, column: number): boolean {
  return room.winningLine.some((point: BoardPoint) => point.row === row && point.column === column);
}

function modeLabel(difficulty: BotDifficulty): string {
  if (difficulty === "casual") return "Casual";
  if (difficulty === "sharp") return "Sharp";
  return "Ruthless";
}
