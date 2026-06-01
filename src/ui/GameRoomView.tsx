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
import type { BoardPoint, BotDifficulty, GameId, GameMove } from "../shared/games";
import { GAME_IDS, getGameDefinition } from "../shared/games";
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
  onSetBotDifficulty
}: GameRoomViewProps) {
  const [message, setMessage] = useState("");
  const definition = getGameDefinition(room.gameId);
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

        <section className={`board-stage ${room.gameId}`}>
          <Board room={room} canMove={canMove} onMove={onMove} />
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
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  onMove: (move: GameMove) => void;
}) {
  if (room.gameId === "four-in-a-row") {
    return <FourInARowBoard room={room} canMove={canMove} onMove={onMove} />;
  }

  if (room.gameId === "tic-tac-toe") {
    return <TicTacToeBoard room={room} canMove={canMove} onMove={onMove} />;
  }

  return <GomokuBoard room={room} canMove={canMove} onMove={onMove} />;
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
    <div className="tic-board" role="group" aria-label="Tic Tac Toe board">
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
