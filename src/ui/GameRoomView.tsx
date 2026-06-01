import {
  Bot,
  Copy,
  Eye,
  HelpCircle,
  History,
  Home,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
  UsersRound
} from "lucide-react";
import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { BoardPoint, BotDifficulty, BoardVariant, GameId, GameMove, PlayerMark } from "../shared/games";
import { GAME_IDS, getBoardVariantOptions, getGameDefinition, isSoloGame } from "../shared/games";
import { REACTIONS, type AppliedMove, type RoomSnapshot } from "../shared/protocol";

interface GameRoomViewProps {
  room: RoomSnapshot;
  guestToken: string;
  inviteUrl: string;
  copiedInvite: boolean;
  lastMove?: AppliedMove | null;
  onCopyInvite: () => void;
  onMove: (move: GameMove) => void;
  onChat: (body: string) => void;
  onReaction: (emoji: string) => void;
  onRematch: () => void;
  onRequestUndo: () => void;
  onClaimSeat: () => void;
  onSwitchGame: (gameId: GameId) => void;
  onSetBoardVariant: (variant: BoardVariant) => void;
  onSetBotDifficulty: (difficulty: BotDifficulty) => void;
}

export function GameRoomView({
  room,
  guestToken,
  inviteUrl,
  copiedInvite,
  lastMove = null,
  onCopyInvite,
  onMove,
  onChat,
  onReaction,
  onRematch,
  onRequestUndo,
  onClaimSeat,
  onSwitchGame,
  onSetBoardVariant,
  onSetBotDifficulty
}: GameRoomViewProps) {
  const [message, setMessage] = useState("");
  const definition = getGameDefinition(room.gameId);
  const solo = isSoloGame(room.gameId);
  const boardVariantOptions = getBoardVariantOptions(room.gameId);
  const currentPlayer = room.players.find((player) => player.guestToken === guestToken);
  const currentTurnPlayer = room.players.find((player) => player.mark === room.turn);
  const humanPlayers = room.players.filter((player) => !player.isBot);
  const connectedHumanPlayers = humanPlayers.filter((player) => player.connected);
  const voteTarget = room.opponent === "friend" ? Math.max(1, connectedHumanPlayers.length) : 1;
  const rematchText = room.rematchRequests.length > 0 && room.opponent === "friend"
    ? `Rematch vote ${room.rematchRequests.length}/${voteTarget}`
    : "Rematch";
  const undoText = room.undoRequests.length > 0
    ? `Undo requested ${room.undoRequests.length}/${voteTarget}`
    : "Undo";
  const openSeat = room.opponent === "friend" && (
    room.players.some((player) => !player.connected && !player.isBot) ||
    room.players.filter((player) => !player.isBot).length < 2
  );
  const canMove = Boolean(currentPlayer && currentPlayer.mark === room.turn && !room.winner);
  const status = solo
    ? "Solo run"
    : room.winner
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
            {rematchText}
          </button>
        </header>

        {room.winner ? (
          <section className="game-over-banner" aria-label="Game over">
            <Sparkles size={20} />
            <strong>
              {room.winner === "draw" ? "Draw table" : `${definition.playerNames[room.winner]} wins`}
            </strong>
            <span>{room.winner === "draw" ? "Everybody gets the dramatic stare." : "The table has chosen a legend."}</span>
          </section>
        ) : null}

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
          <Board room={room} canMove={canMove} currentMark={currentPlayer?.mark} lastMove={lastMove} onMove={onMove} />
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

        {room.opponent === "bot" && !solo ? (
          <section className="bot-strip" aria-label="Bot mode">
            <div className="section-title"><Bot size={16} /> Bot mode</div>
            <p className="bot-personality">{botPersonality(room.botDifficulty, room.gameId)}</p>
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

        <section className="rules-strip" aria-label="Rules">
          <div className="section-title"><HelpCircle size={16} /> Rules</div>
          <p>{rulesFor(room.gameId)}</p>
        </section>

        <section className="history-strip" aria-label="Move history">
          <div className="section-title"><History size={16} /> Moves</div>
          {room.moveHistory.length > 0 ? (
            <ol className="move-list">
              {room.moveHistory.slice(-6).map((move) => (
                <li className={move.player} key={move.id}>
                  <span>{move.name}</span>
                  <strong>{move.label}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="quiet-note">No moves yet.</p>
          )}
          {currentPlayer && room.opponent === "friend" ? (
            <button className="ghost-button compact-action" type="button" aria-label="Request undo" onClick={onRequestUndo}>
              <Undo2 size={16} />
              {undoText}
            </button>
          ) : null}
        </section>

        {room.spectators.length > 0 || (!currentPlayer && openSeat) ? (
          <section className="spectator-strip" aria-label="Spectators">
            <div className="section-title"><Eye size={16} /> Spectators</div>
            {room.spectators.map((spectator) => (
              <div className="spectator-row" key={spectator.guestToken}>
                <span>{spectator.name}</span>
                <small>{spectator.connected ? "watching" : "away"}</small>
              </div>
            ))}
            {!currentPlayer && openSeat ? (
              <button className="primary-button compact-action" type="button" onClick={onClaimSeat}>
                Take open seat
              </button>
            ) : null}
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
  lastMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  currentMark?: PlayerMark;
  lastMove: AppliedMove | null;
  onMove: (move: GameMove) => void;
}) {
  if (room.gameId === "four-in-a-row") {
    return <FourInARowBoard room={room} canMove={canMove} lastMove={lastMove} onMove={onMove} />;
  }

  if (room.gameId === "tic-tac-toe") {
    return <TicTacToeBoard room={room} canMove={canMove} lastMove={lastMove} onMove={onMove} />;
  }

  if (room.gameId === "gomoku") {
    return <GomokuBoard room={room} canMove={canMove} lastMove={lastMove} onMove={onMove} />;
  }

  if (room.gameId === "ultimate-tic-tac-toe") {
    return <UltimateTicTacToeBoard room={room} canMove={canMove} lastMove={lastMove} onMove={onMove} />;
  }

  if (room.gameId === "dots-and-boxes") {
    return <DotsAndBoxesBoard room={room} canMove={canMove} lastMove={lastMove} onMove={onMove} />;
  }

  if (room.gameId === "reversi") {
    return <GridStoneBoard room={room} canMove={canMove} lastMove={lastMove} onMove={onMove} label="Reversi board" className="reversi-board" />;
  }

  if (room.gameId === "checkers") {
    return <CheckersBoard room={room} canMove={canMove} currentMark={currentMark} lastMove={lastMove} onMove={onMove} />;
  }

  if (room.gameId === "battleship") {
    return <BattleshipBoard room={room} canMove={canMove} lastMove={lastMove} onMove={onMove} />;
  }

  if (room.gameId === "mancala") {
    return <MancalaBoard room={room} canMove={canMove} currentMark={currentMark} lastMove={lastMove} onMove={onMove} />;
  }

  if (room.gameId === "hex") {
    return <GridStoneBoard room={room} canMove={canMove} lastMove={lastMove} onMove={onMove} label="Hex board" className="hex-board" />;
  }

  if (room.gameId === "nine-mens-morris") {
    return <MorrisBoard room={room} canMove={canMove} currentMark={currentMark} lastMove={lastMove} onMove={onMove} />;
  }

  return <FlappyBirdGame />;
}

function FourInARowBoard({
  room,
  canMove,
  lastMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  lastMove: AppliedMove | null;
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
                className={`connect-slot ${cell ?? ""} ${isWinning(room, rowIndex, columnIndex) ? "win" : ""} ${isLastMove(lastMove, rowIndex, columnIndex) ? "last-move" : ""}`}
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
  lastMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  lastMove: AppliedMove | null;
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
            className={`${isWinning(room, rowIndex, columnIndex) ? "win" : ""} ${isLastMove(lastMove, rowIndex, columnIndex) ? "last-move" : ""}`}
            type="button"
            aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
            disabled={!canMove || Boolean(cell)}
            onClick={() => onMove({ row: rowIndex, column: columnIndex })}
            key={`${rowIndex}-${columnIndex}`}
          >
            {cell ? <span className={`tic-mark ${cell}`} aria-hidden="true" /> : null}
          </button>
        ))
      )}
    </div>
  );
}

function GomokuBoard({
  room,
  canMove,
  lastMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  lastMove: AppliedMove | null;
  onMove: (move: GameMove) => void;
}) {
  return (
    <div className="gomoku-board" role="group" aria-label="Gomoku board">
      {room.board.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => (
          <button
            className={`${cell ?? ""} ${isWinning(room, rowIndex, columnIndex) ? "win" : ""} ${isLastMove(lastMove, rowIndex, columnIndex) ? "last-move" : ""}`}
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
  lastMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  lastMove: AppliedMove | null;
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
              className={`${isWinning(room, rowIndex, columnIndex) ? "win" : ""} ${playable ? "active-mini" : ""} ${claimed ? "claimed-mini" : ""} ${isLastMove(lastMove, rowIndex, columnIndex) ? "last-move" : ""}`}
              type="button"
              aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
              disabled={!canMove || Boolean(cell) || !playable || claimed}
              onClick={() => onMove({ row: rowIndex, column: columnIndex })}
              key={`${rowIndex}-${columnIndex}`}
            >
              {cell ? <span className={`tic-mark ${cell}`} aria-hidden="true" /> : null}
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
  lastMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  lastMove: AppliedMove | null;
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
            className={`${drawn ? "dot-edge horizontal drawn" : "dot-edge horizontal"} ${isLastEdgeMove(lastMove, "h", edgeRow, edgeColumn) ? "last-move" : ""}`}
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
            className={`${drawn ? "dot-edge vertical drawn" : "dot-edge vertical"} ${isLastEdgeMove(lastMove, "v", edgeRow, edgeColumn) ? "last-move" : ""}`}
            type="button"
            aria-label={`Vertical line ${edgeRow + 1}, ${edgeColumn + 1}`}
            disabled={!canMove || drawn}
            onClick={() => onMove({ edge: "v", row: edgeRow, column: edgeColumn })}
            key={`${row}-${column}`}
          />
        );
      } else {
        const boxRow = Math.floor(row / 2);
        const boxColumn = Math.floor(column / 2);
        const box = room.board[boxRow]?.[boxColumn];
        const sides = countDotBoxSides(dots, boxRow, boxColumn);
        const boxState = box
          ? `claimed by ${box === "p1" ? "Blue" : "Red"}`
          : `open with ${sides} sides`;
        items.push(
          <span
            className={`dot-box ${box ?? ""} ${!box && sides === 3 ? "almost" : ""} ${isLastMove(lastMove, boxRow, boxColumn) && box ? "last-move" : ""}`}
            aria-label={`Box ${boxRow + 1}, ${boxColumn + 1} ${boxState}`}
            key={`${row}-${column}`}
          />
        );
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
  className,
  lastMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  onMove: (move: GameMove) => void;
  label: string;
  className: string;
  lastMove: AppliedMove | null;
}) {
  return (
    <div className={className} role="group" aria-label={label}>
      {room.board.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => (
          <button
            className={`${cell ?? ""} ${isWinning(room, rowIndex, columnIndex) ? "win" : ""} ${isLastMove(lastMove, rowIndex, columnIndex) ? "last-move" : ""}`}
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
  lastMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  currentMark?: PlayerMark;
  lastMove: AppliedMove | null;
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
              className={`${dark ? "dark" : "light"} ${cell ?? ""} ${isSelected ? "selected" : ""} ${kings.has(`${rowIndex},${columnIndex}`) ? "king" : ""} ${isLastMove(lastMove, rowIndex, columnIndex) ? "last-move" : ""}`}
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
  lastMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  lastMove: AppliedMove | null;
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
                className={`${shot ?? ""} ${isLastMove(lastMove, rowIndex, columnIndex) ? "last-move" : ""}`}
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
  lastMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  currentMark?: PlayerMark;
  lastMove: AppliedMove | null;
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
              className={isLastMove(lastMove, 0, column) ? "last-move" : ""}
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
            className={isLastMove(lastMove, 1, column) ? "last-move" : ""}
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
  lastMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  currentMark?: PlayerMark;
  lastMove: AppliedMove | null;
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
              className={`${playable ? "point" : "blank"} ${cell ?? ""} ${isSelected ? "selected" : ""} ${isLastMove(lastMove, rowIndex, columnIndex) ? "last-move" : ""}`}
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

interface FlappyPipe {
  id: number;
  x: number;
  gapTop: number;
  scored: boolean;
}

interface FlappyRun {
  phase: "ready" | "playing" | "crashed";
  birdY: number;
  velocity: number;
  pipes: FlappyPipe[];
  score: number;
  best: number;
}

const FLAPPY_WIDTH = 420;
const FLAPPY_HEIGHT = 620;
const FLAPPY_GROUND = 78;
const FLAPPY_BIRD_X = 116;
const FLAPPY_BIRD_SIZE = 34;
const FLAPPY_PIPE_WIDTH = 66;
const FLAPPY_GAP = 158;
const FLAPPY_BEST_KEY = "table-sparks-flappy-best";

function FlappyBirdGame() {
  const [run, setRun] = useState<FlappyRun>(() => ({
    phase: "ready",
    birdY: 250,
    velocity: 0,
    pipes: [makePipe(FLAPPY_WIDTH + 34, 1)],
    score: 0,
    best: Number(localStorage.getItem(FLAPPY_BEST_KEY) ?? 0)
  }));
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const nextPipeIdRef = useRef(2);

  useEffect(() => {
    if (run.phase !== "playing") return;

    const tick = (time: number) => {
      const previous = lastFrameRef.current ?? time;
      const delta = Math.min((time - previous) / 1000, 0.034);
      lastFrameRef.current = time;
      setRun((current) => advanceFlappyRun(current, delta, nextPipeIdRef));
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameRef.current = null;
    };
  }, [run.phase]);

  useEffect(() => {
    if (run.phase === "crashed" && run.score > run.best) {
      localStorage.setItem(FLAPPY_BEST_KEY, String(run.score));
      setRun((current) => ({ ...current, best: run.score }));
    }
  }, [run.best, run.phase, run.score]);

  const flap = () => {
    setRun((current) => {
      if (current.phase !== "playing") {
        nextPipeIdRef.current = 2;
        return {
          phase: "playing",
          birdY: 250,
          velocity: -345,
          pipes: [makePipe(FLAPPY_WIDTH + 34, 1)],
          score: 0,
          best: current.best
        };
      }
      return { ...current, velocity: -345 };
    });
  };

  return (
    <div
      className={`flappy-game ${run.phase}`}
      role="application"
      aria-label="Flappy Bird"
      tabIndex={0}
      onPointerDown={flap}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "ArrowUp" || event.key === "Enter") {
          event.preventDefault();
          flap();
        }
      }}
    >
      <div className="flappy-score" aria-label="Score">
        <span>{run.score}</span>
        <small>Best {run.best}</small>
      </div>
      <div
        className="flappy-bird-sprite"
        style={{ "--bird-y": `${(run.birdY / FLAPPY_HEIGHT) * 100}%`, "--bird-tilt": `${Math.max(-18, Math.min(42, run.velocity / 11))}deg` } as CSSProperties}
      >
        <span />
      </div>
      {run.pipes.map((pipe) => (
        <div
          className="flappy-pipe"
          style={{
            "--pipe-x": `${(pipe.x / FLAPPY_WIDTH) * 100}%`,
            "--gap-top": `${(pipe.gapTop / FLAPPY_HEIGHT) * 100}%`,
            "--gap-size": `${(FLAPPY_GAP / FLAPPY_HEIGHT) * 100}%`
          } as CSSProperties}
          key={pipe.id}
        >
          <span className="pipe-top" />
          <span className="pipe-bottom" />
        </div>
      ))}
      <div className="flappy-cloud one" />
      <div className="flappy-cloud two" />
      <div className="flappy-ground" />
      {run.phase !== "playing" ? (
        <button className="flappy-start" type="button" aria-label="Start run" onClick={(event) => {
          event.stopPropagation();
          flap();
        }}>
          {run.phase === "crashed" ? "Again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}

function advanceFlappyRun(
  run: FlappyRun,
  delta: number,
  nextPipeIdRef: { current: number }
): FlappyRun {
  if (run.phase !== "playing") return run;

  const velocity = run.velocity + 940 * delta;
  const birdY = run.birdY + velocity * delta;
  let score = run.score;
  let pipes = run.pipes
    .map((pipe) => {
      const x = pipe.x - 150 * delta;
      const scored = pipe.scored || x + FLAPPY_PIPE_WIDTH < FLAPPY_BIRD_X;
      if (!pipe.scored && scored) score += 1;
      return { ...pipe, x, scored };
    })
    .filter((pipe) => pipe.x > -FLAPPY_PIPE_WIDTH - 8);

  const lastPipe = pipes.at(-1);
  if (!lastPipe || lastPipe.x < FLAPPY_WIDTH - 184) {
    pipes = [...pipes, makePipe(FLAPPY_WIDTH + 34, nextPipeIdRef.current)];
    nextPipeIdRef.current += 1;
  }

  const crashed =
    birdY < 0 ||
    birdY + FLAPPY_BIRD_SIZE > FLAPPY_HEIGHT - FLAPPY_GROUND ||
    pipes.some((pipe) => hitsPipe(pipe, birdY));

  return {
    ...run,
    birdY,
    velocity,
    pipes,
    score,
    phase: crashed ? "crashed" : "playing"
  };
}

function hitsPipe(pipe: FlappyPipe, birdY: number): boolean {
  const birdLeft = FLAPPY_BIRD_X;
  const birdRight = FLAPPY_BIRD_X + FLAPPY_BIRD_SIZE;
  const birdTop = birdY;
  const birdBottom = birdY + FLAPPY_BIRD_SIZE;
  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + FLAPPY_PIPE_WIDTH;
  const overlapsX = birdRight > pipeLeft && birdLeft < pipeRight;
  const insideGap = birdTop > pipe.gapTop && birdBottom < pipe.gapTop + FLAPPY_GAP;
  return overlapsX && !insideGap;
}

function makePipe(x: number, id: number): FlappyPipe {
  return {
    id,
    x,
    gapTop: 106 + Math.floor(Math.random() * 258),
    scored: false
  };
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

function isLastMove(lastMove: AppliedMove | null, row: number, column: number): boolean {
  return Boolean(lastMove && lastMove.row === row && lastMove.column === column);
}

function isLastEdgeMove(lastMove: AppliedMove | null, edge: "h" | "v", row: number, column: number): boolean {
  return Boolean(lastMove && lastMove.edge === edge && lastMove.row === row && lastMove.column === column);
}

function countDotBoxSides(dots: NonNullable<RoomSnapshot["meta"]>["dots"], row: number, column: number): number {
  if (!dots) return 0;
  return Number(dots.hEdges[row]?.[column]) +
    Number(dots.hEdges[row + 1]?.[column]) +
    Number(dots.vEdges[row]?.[column]) +
    Number(dots.vEdges[row]?.[column + 1]);
}

function isWinning(room: RoomSnapshot, row: number, column: number): boolean {
  return room.winningLine.some((point: BoardPoint) => point.row === row && point.column === column);
}

function modeLabel(difficulty: BotDifficulty): string {
  if (difficulty === "casual") return "Casual";
  if (difficulty === "sharp") return "Sharp";
  return "Ruthless";
}

function rulesFor(gameId: GameId): string {
  if (gameId === "four-in-a-row") return "Connect four pieces horizontally, vertically, or diagonally.";
  if (gameId === "tic-tac-toe") return "Claim the needed line on your selected grid size before the other marker does.";
  if (gameId === "gomoku") return "Place stones on intersections. First five or more connected stones wins.";
  if (gameId === "ultimate-tic-tac-toe") return "Your move sends the opponent to the matching small board. Win small boards to win the big board.";
  if (gameId === "dots-and-boxes") return "Draw lines between dots. Complete a box to score it and keep the turn.";
  if (gameId === "reversi") return "Place a disc to trap opponent discs in a line. Trapped discs flip to your side.";
  if (gameId === "checkers") return "Move diagonally on dark squares, jump captures, and crown kings on the far edge.";
  if (gameId === "battleship") return "Fire at the bot fleet. Hits reveal ship squares, misses mark the water.";
  if (gameId === "mancala") return "Pick a pit on your side, sow stones counter-clockwise, and capture opposite stones.";
  if (gameId === "hex") return "Connect your assigned sides with an unbroken chain of stones.";
  if (gameId === "flappy-bird") return "Thread the bird through shifting pipe gaps and chase a clean high score.";
  return "Place nine pieces, form mills of three, then slide pieces and remove opponent pieces.";
}

function botPersonality(difficulty: BotDifficulty, gameId: GameId): string {
  if (difficulty === "casual") return "Loose and playful. It sees obvious wins but leaves room for drama.";
  if (difficulty === "sharp") return "Tactical and alert. It blocks threats and builds pressure.";
  return gameId === "battleship"
    ? "Cold sonar mode. It hunts patterns and celebrates every hit internally."
    : "Ruthless table brain. It searches for wins, blocks traps, and prefers center control.";
}
