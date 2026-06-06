import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  Copy,
  Eye,
  HelpCircle,
  History,
  Home,
  MessageCircle,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  UsersRound,
  Volume2,
  VolumeX
} from "lucide-react";
import { type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BattleshipShip, BoardPoint, BotDifficulty, BoardVariant, Cell, DominoTile, GameId, GameMove, LastCardCard, PlayerMark } from "../shared/games";
import { canBotStart, GAME_IDS, getBoardVariantOptions, getGameDefinition, isSoloGame, maxPlayersForGame, playerNameFor } from "../shared/games";
import { REACTIONS, type AppliedMove, type RoomSnapshot } from "../shared/protocol";
import { ThreeGameScene } from "./ThreeGameScene";

type ConnectionStatus = "connecting" | "connected" | "reconnecting";

interface GameRoomViewProps {
  room: RoomSnapshot;
  guestToken: string;
  connectionStatus: ConnectionStatus;
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
  onSetBotStarts?: (botStarts: boolean) => void;
}

const DARTBOARD_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;
const DARTBOARD_BULL_COLUMN = 20;
const DARTBOARD_DOUBLE_BULL_COLUMN = 21;
const DARTBOARD_MISS_COLUMN = -1;

export interface DartThrowResolution {
  move: GameMove;
  label: string;
  score: number;
  zone: "miss" | "single" | "double" | "triple" | "bull" | "double-bull";
  xPct: number;
  yPct: number;
}

export function resolveDartThrow(x: number, y: number, width: number, height: number): DartThrowResolution {
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) {
    return dartResolution({ row: 0, column: DARTBOARD_MISS_COLUMN }, "Miss", 0, "miss", 50, 50);
  }

  const size = Math.max(1, Math.min(width, height));
  const centerX = width / 2;
  const centerY = height / 2;
  const dx = x - centerX;
  const dy = y - centerY;
  const radius = Math.sqrt(dx * dx + dy * dy) / (size / 2);
  const xPct = clamp((x / width) * 100, 0, 100);
  const yPct = clamp((y / height) * 100, 0, 100);
  const degreesFromTop = (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360;
  const segmentIndex = Math.floor((degreesFromTop + 9) / 18) % DARTBOARD_SEGMENTS.length;
  const segment = DARTBOARD_SEGMENTS[segmentIndex];

  if (radius > 0.825) {
    return dartResolution({ row: 0, column: DARTBOARD_MISS_COLUMN }, "Miss", 0, "miss", xPct, yPct);
  }
  if (radius <= 0.047) {
    return dartResolution({ row: 50, column: DARTBOARD_DOUBLE_BULL_COLUMN }, "Double Bull", 50, "double-bull", xPct, yPct);
  }
  if (radius <= 0.092) {
    return dartResolution({ row: 25, column: DARTBOARD_BULL_COLUMN }, "Bull", 25, "bull", xPct, yPct);
  }
  if (radius >= 0.518 && radius <= 0.575) {
    return dartResolution({ row: 3, column: segmentIndex }, `T${segment}`, segment * 3, "triple", xPct, yPct);
  }
  if (radius >= 0.758) {
    return dartResolution({ row: 2, column: segmentIndex }, `D${segment}`, segment * 2, "double", xPct, yPct);
  }
  return dartResolution({ row: 1, column: segmentIndex }, `S${segment}`, segment, "single", xPct, yPct);
}

function dartResolution(
  move: GameMove,
  label: string,
  score: number,
  zone: DartThrowResolution["zone"],
  xPct: number,
  yPct: number
): DartThrowResolution {
  return { move, label, score, zone, xPct, yPct };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function GameRoomView({
  room,
  guestToken,
  connectionStatus,
  inviteUrl,
  copiedInvite,
  lastMove = null,
  onCopyInvite,
  onMove,
  onChat,
  onReaction,
  onRematch,
  onClaimSeat,
  onSwitchGame,
  onSetBoardVariant,
  onSetBotDifficulty,
  onSetBotStarts = () => undefined
}: GameRoomViewProps) {
  const [message, setMessage] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference);
  const definition = getGameDefinition(room.gameId);
  const solo = isSoloGame(room.gameId);
  const boardVariantOptions = getBoardVariantOptions(room.gameId);
  const currentPlayer = room.players.find((player) => player.guestToken === guestToken);
  const currentSpectator = room.spectators.find((spectator) => spectator.guestToken === guestToken);
  const currentTurnPlayer = room.players.find((player) => player.mark === room.turn);
  const humanPlayers = room.players.filter((player) => !player.isBot);
  const connectedHumanPlayers = humanPlayers.filter((player) => player.connected);
  const disconnectedOpponents = humanPlayers.filter((player) =>
    !player.connected && player.guestToken !== guestToken
  );
  const voteTarget = room.opponent === "friend" ? Math.max(1, connectedHumanPlayers.length) : 1;
  const isHost = currentPlayer?.mark === "p1";
  const settingsLocked = !isHost;
  const rematchText = room.rematchRequests.length > 0 && room.opponent === "friend"
    ? `Rematch vote ${room.rematchRequests.length}/${voteTarget}`
    : "Rematch";
  const openSeat = room.opponent === "friend" && (
    room.players.some((player) => !player.connected && !player.isBot) ||
    room.players.filter((player) => !player.isBot).length < maxPlayersForGame(room.gameId)
  );
  const canMove = Boolean(currentPlayer && currentPlayer.mark === room.turn && !room.winner);
  const spectatorReactionsLocked = Boolean(currentSpectator && !room.winner);
  const lastMovePlayer = lastMove ? room.players.find((player) => player.mark === lastMove.player) : undefined;
  const lastMoveIsBot = Boolean(lastMovePlayer?.isBot);
  const gameplayStatus = solo
    ? "Solo run"
    : disconnectedOpponents.length > 0 && !room.winner
    ? "Opponent reconnecting"
    : room.winner
    ? room.winner === "draw"
      ? "Draw table"
      : `${playerNameFor(room.gameId, room.winner)} wins`
    : currentTurnPlayer?.isBot
      ? `${currentTurnPlayer.name} thinking`
      : `${playerNameFor(room.gameId, room.turn)} to move`;
  const status = connectionStatus === "connected"
    ? gameplayStatus
    : connectionStatus === "reconnecting"
      ? "Reconnecting..."
      : "Connecting...";

  useEffect(() => {
    writeSoundPreference(soundEnabled);
  }, [soundEnabled]);

  useGameFeedback(room, lastMove, soundEnabled);

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
              disabled={settingsLocked}
              title={settingsLocked ? "Only the host can switch games." : `Switch to ${getGameDefinition(gameId).name}`}
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
          <div className={`status-chip connection-${connectionStatus}`}>{status}</div>
          <button
            className="icon-button sound-toggle"
            type="button"
            aria-label={soundEnabled ? "Mute sounds" : "Unmute sounds"}
            title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
            onClick={() => setSoundEnabled((enabled) => !enabled)}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button className="icon-text-button" type="button" onClick={onRematch}>
            <RotateCcw size={18} />
            {rematchText}
          </button>
        </header>

        {room.winner ? (
          <section className="game-over-banner" aria-label="Game over">
            <Sparkles size={20} />
            <strong>
              {room.winner === "draw" ? "Draw table" : `${playerNameFor(room.gameId, room.winner)} wins`}
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
                disabled={settingsLocked}
                onClick={() => onSetBoardVariant(option.id)}
                key={option.id}
              >
                {option.label}
              </button>
            ))}
          </section>
        ) : null}

        <section className={`board-stage ${room.gameId} variant-${room.boardVariant} ${lastMoveIsBot ? "bot-move-stage" : ""}`}>
          <Board room={room} canMove={canMove} currentMark={currentPlayer?.mark} lastMove={lastMove} onMove={onMove} />
        </section>

        <section className={spectatorReactionsLocked ? "reaction-dock locked" : "reaction-dock"} aria-label="Reactions">
          <span><Sparkles size={16} /> {spectatorReactionsLocked ? "Finale reactions" : "React"}</span>
          {REACTIONS.map((emoji) => (
            <button
              type="button"
              className="reaction-button"
              aria-label={`React with ${emoji}`}
              title={spectatorReactionsLocked ? "Spectators can react after the game ends." : `React with ${emoji}`}
              disabled={spectatorReactionsLocked}
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
              <small>{player.isBot ? "bot" : player.connected ? "live" : "reconnecting"}</small>
            </div>
          ))}
          {currentPlayer ? <p className="seat-note">You are {playerNameFor(room.gameId, currentPlayer.mark)}.</p> : null}
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
                  disabled={settingsLocked}
                  onClick={() => onSetBotDifficulty(difficulty)}
                  key={difficulty}
                >
                  {modeLabel(difficulty)}
                </button>
              ))}
            </div>
            {canBotStart(room.gameId) ? (
              <label className="bot-start-toggle">
                <input
                  type="checkbox"
                  checked={room.botStarts}
                  disabled={settingsLocked}
                  onChange={(event) => onSetBotStarts(event.target.checked)}
                />
                <span>Bot starts</span>
              </label>
            ) : null}
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

  if (room.gameId === "last-card") {
    return <LastCardBoard room={room} canMove={canMove} currentMark={currentMark} onMove={onMove} />;
  }

  if (room.gameId === "darts") {
    return <DartsBoard room={room} canMove={canMove} onMove={onMove} />;
  }

  if (room.gameId === "word-hunt") {
    return <WordHuntBoard room={room} canMove={Boolean(currentMark && !room.winner)} currentMark={currentMark} onMove={onMove} />;
  }

  if (room.gameId === "cup-pong") {
    return <CupPongBoard room={room} canMove={canMove} currentMark={currentMark} lastMove={lastMove} onMove={onMove} />;
  }

  if (room.gameId === "dominoes") {
    return <DominoesBoard room={room} canMove={canMove} currentMark={currentMark} onMove={onMove} />;
  }

  if (room.gameId === "snake") {
    return <SnakeGame />;
  }

  if (room.gameId === "twenty-forty-eight") {
    return <TwentyFortyEightGame />;
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
  const sunkShips = (room.meta?.battleship?.botFleet ?? []).filter((ship) => isShipSunk(ship, shots));
  const hitCount = Object.values(shots).filter((shot) => shot === "hit").length;
  return (
    <div className="battleship-wrap">
      <ThreeGameScene kind="battleship" stateKey={`${hitCount}-${sunkShips.length}-${Object.keys(shots).length}`} intensity={hitCount + sunkShips.length * 2} />
      <div className="fleet-status">
        <span>Your hits {hitCount}</span>
        <span>Incoming {Object.keys(botShots).length}</span>
      </div>
    <div className="battleship-board" role="group" aria-label="Sea Battle target board">
        {room.board.flatMap((row, rowIndex) =>
          row.map((_, columnIndex) => {
            const shot = shots[`${rowIndex},${columnIndex}`];
            return (
              <button
                className={`${shot ?? ""} ${isLastMove(lastMove, rowIndex, columnIndex) ? "last-move" : ""}`}
                type="button"
                aria-label={`Fire row ${rowIndex + 1}, column ${columnIndex + 1}`}
                disabled={!canMove || Boolean(shot)}
                style={{ gridRow: rowIndex + 1, gridColumn: columnIndex + 1 }}
                onClick={() => onMove({ row: rowIndex, column: columnIndex })}
                key={`${rowIndex}-${columnIndex}`}
              >
                {shot === "hit" ? "X" : shot === "miss" ? "•" : ""}
              </button>
            );
          })
        )}
        {sunkShips.map((ship) => (
          <span
            className={`ship-reveal ${ship.id} ${ship.orientation}`}
            role="img"
            aria-label={`Sunk ${ship.name}`}
            style={shipRevealStyle(ship)}
            key={ship.id}
          >
            <span />
          </span>
        ))}
      </div>
    </div>
  );
}

function isShipSunk(ship: BattleshipShip, shots: Record<string, "hit" | "miss">): boolean {
  return ship.cells.every((cell) => shots[`${cell.row},${cell.column}`] === "hit");
}

function shipRevealStyle(ship: BattleshipShip): CSSProperties {
  const rows = ship.cells.map((cell) => cell.row);
  const columns = ship.cells.map((cell) => cell.column);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minColumn = Math.min(...columns);
  const maxColumn = Math.max(...columns);

  return {
    gridRow: `${minRow + 1} / span ${maxRow - minRow + 1}`,
    gridColumn: `${minColumn + 1} / span ${maxColumn - minColumn + 1}`
  } as CSSProperties;
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
  const pendingRemoval = room.meta?.morris?.pendingRemoval ?? null;
  const removeMode = Boolean(pendingRemoval && pendingRemoval === currentMark);
  const removable = removeMode && currentMark
    ? morrisRemovalTargets(room.board, currentMark === "p1" ? "p2" : "p1")
    : new Set<string>();

  return (
    <div className={removeMode ? "morris-board removing" : "morris-board"} role="group" aria-label="Nine Men's Morris board">
      {room.board.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => {
          const key = `${rowIndex},${columnIndex}`;
          const playable = points.has(key);
          const isSelected = selected?.row === rowIndex && selected.column === columnIndex;
          const canRemove = removable.has(key);
          return (
            <button
              className={`${playable ? "point" : "blank"} ${cell ?? ""} ${isSelected ? "selected" : ""} ${canRemove ? "removable" : ""} ${isLastMove(lastMove, rowIndex, columnIndex) ? "last-move" : ""}`}
              type="button"
              aria-label={`${canRemove ? "Remove" : "Point"} ${rowIndex + 1}, ${columnIndex + 1}`}
              disabled={!canMove || !playable || (removeMode && !canRemove)}
              onClick={() => {
                if (removeMode) {
                  if (canRemove) onMove({ row: rowIndex, column: columnIndex });
                  return;
                }
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

function morrisRemovalTargets(board: Cell[][], opponent: PlayerMark): Set<string> {
  const occupied = MORRIS_UI_POINTS.filter((key) => cellAtBoard(board, key) === opponent);
  const exposed = occupied.filter((key) => !morrisUiFormsMill(board, key, opponent));
  return new Set(exposed.length > 0 ? exposed : occupied);
}

function morrisUiFormsMill(board: Cell[][], key: string, player: PlayerMark): boolean {
  return MORRIS_UI_MILLS.some((mill) =>
    mill.includes(key) && mill.every((pointKey) => cellAtBoard(board, pointKey) === player)
  );
}

function cellAtBoard(board: Cell[][], key: string): Cell | undefined {
  const [row, column] = key.split(",").map(Number);
  return board[row]?.[column];
}

const MORRIS_UI_POINTS = [
  "0,0", "0,3", "0,6",
  "1,1", "1,3", "1,5",
  "2,2", "2,3", "2,4",
  "3,0", "3,1", "3,2", "3,4", "3,5", "3,6",
  "4,2", "4,3", "4,4",
  "5,1", "5,3", "5,5",
  "6,0", "6,3", "6,6"
];

const MORRIS_UI_MILLS = [
  ["0,0", "0,3", "0,6"], ["1,1", "1,3", "1,5"], ["2,2", "2,3", "2,4"],
  ["3,0", "3,1", "3,2"], ["3,4", "3,5", "3,6"], ["4,2", "4,3", "4,4"],
  ["5,1", "5,3", "5,5"], ["6,0", "6,3", "6,6"], ["0,0", "3,0", "6,0"],
  ["1,1", "3,1", "5,1"], ["2,2", "3,2", "4,2"], ["0,3", "1,3", "2,3"],
  ["4,3", "5,3", "6,3"], ["2,4", "3,4", "4,4"], ["1,5", "3,5", "5,5"],
  ["0,6", "3,6", "6,6"]
];

const LAST_CARD_DRAW_COLUMN = -1;

function LastCardBoard({
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
  const meta = room.meta?.lastCard;
  const topCard = meta?.discard.at(-1);
  if (!meta || !topCard) return null;

  const hand = currentMark ? meta.hands[currentMark] ?? [] : [];
  const deckCount = meta.deckCount ?? meta.deck.length;
  const hasPlayableCard = hand.some((card) => lastCardPlayable(card, topCard, meta.currentColor, hand));
  const canDraw = canMove && !hasPlayableCard && (deckCount > 0 || meta.discard.length > 1);

  return (
    <div className="last-card-table" role="group" aria-label="Color Clash table">
      <div className="last-card-players" aria-label="Card counts">
        {(["p1", "p2"] as const).map((mark) => {
          const player = room.players.find((candidate) => candidate.mark === mark);
          return (
            <div className={`last-card-player ${mark} ${room.turn === mark && !room.winner ? "active" : ""}`} key={mark}>
              <span>{playerNameFor(room.gameId, mark)}</span>
              <strong>{meta.handCounts[mark]} cards</strong>
              <small>{player?.name ?? "Open seat"}</small>
            </div>
          );
        })}
      </div>

      <div className="last-card-center">
        <button
          className="last-card-draw"
          type="button"
          disabled={!canDraw}
          aria-label="Draw a card"
          onClick={() => onMove({ column: LAST_CARD_DRAW_COLUMN })}
        >
          <span className="last-card-back" />
          <strong>Draw</strong>
          <small>{deckCount} left</small>
        </button>

        <div className="last-card-discard" aria-label={`Discard pile showing ${lastCardAria(topCard)}`}>
          <LastCardFace card={topCard} />
          <span className="last-card-pile-count">{meta.discard.length} played</span>
        </div>
      </div>

      <div className="last-card-event" aria-live="polite">
        {meta.lastDraw ? (
          <span>
            {playerNameFor(room.gameId, meta.lastDraw.player)} drew {meta.lastDraw.count}
            {meta.lastDraw.playable ? " and can play it" : ""}
          </span>
        ) : meta.lastAction && lastCardIsWildAction(meta.lastAction) ? (
          <span>{lastCardRankLabel(meta.lastAction)} changed color to {lastCardColorName(meta.currentColor)}</span>
        ) : meta.lastAction && lastCardIsAction(meta.lastAction) ? (
          <span>{lastCardRankLabel(meta.lastAction)} landed on the table</span>
        ) : (
          <span>Match {lastCardColorName(meta.currentColor)} or {lastCardRankLabel(topCard.rank)}</span>
        )}
      </div>

      <div className="last-card-hand" aria-label={currentMark ? "Your hand" : "Spectator hand view"}>
        {currentMark && hand.length > 0 ? (
          hand.map((card, index) => {
            const playable = lastCardPlayable(card, topCard, meta.currentColor, hand);
            return (
              <button
                className={`last-card-hand-card ${card.color} ${playable ? "playable" : ""}`}
                type="button"
                disabled={!canMove || !playable}
                aria-label={`Play ${lastCardAria(card)}`}
                onClick={() => onMove({ column: index })}
                key={card.id}
              >
                <LastCardFace card={card} />
              </button>
            );
          })
        ) : (
          <div className="last-card-spectator-note">
            <span className="last-card-back" />
            <strong>{currentMark ? "No cards left" : "Hands are private"}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

function DartsBoard({
  room,
  canMove,
  onMove
}: {
  room: RoomSnapshot;
  canMove: boolean;
  onMove: (move: GameMove) => void;
}) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const throwActiveRef = useRef(false);
  const previewTimeoutRef = useRef<number | null>(null);
  const [throwPreview, setThrowPreview] = useState<DartThrowResolution | null>(null);
  const meta = room.meta?.darts;

  useEffect(() => {
    throwActiveRef.current = false;
    setThrowPreview(null);
  }, [meta?.throws.length, meta?.dartsLeft, room.turn]);

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current !== null) window.clearTimeout(previewTimeoutRef.current);
    };
  }, []);

  if (!meta) return null;

  const resolvePointerThrow = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return resolveDartThrow(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
  };

  const beginThrow = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canMove) return;
    event.preventDefault();
    throwActiveRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setThrowPreview(resolvePointerThrow(event));
  };

  const aimThrow = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!throwActiveRef.current || !canMove) return;
    event.preventDefault();
    setThrowPreview(resolvePointerThrow(event));
  };

  const finishThrow = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!throwActiveRef.current || !canMove) return;
    event.preventDefault();
    throwActiveRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const resolved = resolvePointerThrow(event);
    setThrowPreview(resolved);
    onMove(resolved.move);
    if (previewTimeoutRef.current !== null) window.clearTimeout(previewTimeoutRef.current);
    previewTimeoutRef.current = window.setTimeout(() => setThrowPreview(null), 420);
  };

  const cancelThrow = (event: ReactPointerEvent<HTMLDivElement>) => {
    throwActiveRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setThrowPreview(null);
  };

  const throwFromKeyboard = () => {
    if (!canMove) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      onMove({ row: 3, column: 0 });
      return;
    }
    onMove(resolveDartThrow(rect.width / 2, rect.height * 0.225, rect.width, rect.height).move);
  };

  return (
    <div className="darts-table" role="group" aria-label="Darts board">
      <ThreeGameScene kind="darts" stateKey={`${meta.throws.length}-${meta.dartsLeft}-${meta.scores.p1}-${meta.scores.p2}`} intensity={meta.throws.length % 3} />
      <div className="darts-scoreboard">
        {(["p1", "p2"] as PlayerMark[]).map((mark) => (
          <div className={room.turn === mark ? "active" : ""} key={mark}>
            <span>{playerNameFor(room.gameId, mark)}</span>
            <strong>{meta.scores[mark]}</strong>
          </div>
        ))}
        <div>
          <span>Darts left</span>
          <strong>{meta.dartsLeft}</strong>
        </div>
      </div>
      <div
        className={`dartboard ${canMove ? "can-throw" : "waiting"} ${throwPreview ? "aiming" : ""}`}
        ref={boardRef}
        role="button"
        tabIndex={canMove ? 0 : -1}
        aria-label={canMove ? "Throw dart" : "Waiting for turn"}
        aria-disabled={!canMove}
        onPointerDown={beginThrow}
        onPointerMove={aimThrow}
        onPointerUp={finishThrow}
        onPointerCancel={cancelThrow}
        onKeyDown={(event) => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          throwFromKeyboard();
        }}
      >
        <div className="dart-number-ring" aria-hidden="true">
          {DARTBOARD_SEGMENTS.map((segment, index) => {
            const angle = index * 18 - 90;
            const radius = 43;
            const x = 50 + Math.cos((angle * Math.PI) / 180) * radius;
            const y = 50 + Math.sin((angle * Math.PI) / 180) * radius;
            return (
              <span style={{ left: `${x}%`, top: `${y}%` }} key={segment}>{segment}</span>
            );
          })}
        </div>
        {throwPreview ? (
          <span
            className={`dart-aim-reticle ${throwPreview.zone}`}
            style={{ left: `${throwPreview.xPct}%`, top: `${throwPreview.yPct}%` }}
            aria-hidden="true"
          >
            <span>{throwPreview.score > 0 ? `${throwPreview.label} ${throwPreview.score}` : throwPreview.label}</span>
          </span>
        ) : null}
        <span
          className="dart-hand-dart"
          style={{
            left: throwPreview ? `${throwPreview.xPct}%` : "50%",
            top: throwPreview ? `${throwPreview.yPct}%` : "112%"
          }}
          aria-hidden="true"
        />
        <span className="dart-throw-line" aria-hidden="true" />
      </div>
      <div className="dart-throws">
        {throwPreview ? (
          <span className={`dart-preview-pill ${throwPreview.zone}`}>
            {throwPreview.score > 0 ? `${throwPreview.label} · ${throwPreview.score}` : throwPreview.label}
          </span>
        ) : meta.throws.length > 0 ? meta.throws.slice(-5).map((throwItem, index) => (
          <span key={`${throwItem.player}-${throwItem.label}-${index}`}>{throwItem.label}</span>
        )) : <span>Clean checkout.</span>}
      </div>
    </div>
  );
}

function WordHuntBoard({
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
  const [word, setWord] = useState("");
  const [selectedCells, setSelectedCells] = useState<BoardPoint[]>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<BoardPoint[]>([]);
  const pathActiveRef = useRef(false);
  const touchApiRef = useRef<{
    start: (event: TouchEvent) => void;
    move: (event: TouchEvent) => void;
    end: (event: TouchEvent) => void;
    cancel: (event: TouchEvent) => void;
  } | null>(null);
  const [now, setNow] = useState(Date.now());
  const meta = room.meta?.wordHunt;
  useEffect(() => {
    if (!meta || room.winner) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [meta, room.winner]);
  useEffect(() => {
    pathActiveRef.current = false;
    pathRef.current = [];
    setSelectedCells([]);
    setWord("");
  }, [meta?.seed, currentMark]);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;
    const start = (event: TouchEvent) => touchApiRef.current?.start(event);
    const move = (event: TouchEvent) => touchApiRef.current?.move(event);
    const end = (event: TouchEvent) => touchApiRef.current?.end(event);
    const cancel = (event: TouchEvent) => touchApiRef.current?.cancel(event);
    const options = { passive: false };
    grid.addEventListener("touchstart", start, options);
    grid.addEventListener("touchmove", move, options);
    grid.addEventListener("touchend", end, options);
    grid.addEventListener("touchcancel", cancel, options);
    return () => {
      grid.removeEventListener("touchstart", start);
      grid.removeEventListener("touchmove", move);
      grid.removeEventListener("touchend", end);
      grid.removeEventListener("touchcancel", cancel);
    };
  }, [meta?.seed]);
  if (!meta) return null;
  const found = new Set((["p1", "p2", "p3", "p4"] as PlayerMark[]).flatMap((mark) => meta.found[mark] ?? []));
  const durationMs = meta.durationMs || (meta.size === 5 ? 120_000 : 90_000);
  const endsAt = (meta.roundStartedAt || now) + durationMs;
  const remainingMs = Math.max(0, endsAt - now);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const canSubmit = canMove && remainingMs > 0;
  const foundCount = found.size;
  const selectedKeys = new Set(selectedCells.map(wordCellKey));
  const selectedWord = selectedCells.map((cell) => meta.letters[cell.row]?.[cell.column] ?? "").join("");
  const submitWord = (event: FormEvent) => {
    event.preventDefault();
    const clean = word.trim().toUpperCase();
    if (!clean || !canSubmit) return;
    onMove({ column: 0, word: clean });
    setWord("");
    clearWordPath();
  };
  const clearWordPath = () => {
    pathActiveRef.current = false;
    pathRef.current = [];
    setSelectedCells([]);
  };
  const syncPath = (path: BoardPoint[]) => {
    pathRef.current = path;
    setSelectedCells(path);
    setWord(path.map((cell) => meta.letters[cell.row]?.[cell.column] ?? "").join(""));
  };
  const appendCellToPath = (point: BoardPoint) => {
    const path = pathRef.current;
    const existingIndex = path.findIndex((cell) => cell.row === point.row && cell.column === point.column);
    if (existingIndex >= 0) {
      if (existingIndex === path.length - 2) syncPath(path.slice(0, -1));
      return;
    }
    const last = path.at(-1);
    if (last && Math.max(Math.abs(last.row - point.row), Math.abs(last.column - point.column)) > 1) return;
    syncPath([...path, point]);
  };
  const cellFromClient = (clientX: number, clientY: number, target: EventTarget | null): BoardPoint | null => {
    const element =
      document.elementFromPoint?.(clientX, clientY)?.closest<HTMLElement>("[data-word-cell]") ??
      (target instanceof Element ? target.closest<HTMLElement>("[data-word-cell]") : null);
    if (!element || !gridRef.current?.contains(element)) return null;
    const row = Number(element.dataset.row);
    const column = Number(element.dataset.column);
    return Number.isInteger(row) && Number.isInteger(column) ? { row, column } : null;
  };
  const cellFromPointer = (event: ReactPointerEvent<HTMLDivElement>): BoardPoint | null =>
    cellFromClient(event.clientX, event.clientY, event.target);
  const submitSelectedPath = () => {
    const clean = pathRef.current.map((cell) => meta.letters[cell.row]?.[cell.column] ?? "").join("");
    if (canSubmit && clean.length >= 3) onMove({ column: 0, word: clean });
    setWord("");
    clearWordPath();
  };
  const beginPath = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (!canSubmit) return;
    const point = cellFromPointer(event);
    if (!point) return;
    event.preventDefault();
    pathActiveRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    syncPath([point]);
  };
  const movePath = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (!pathActiveRef.current || !canSubmit) return;
    event.preventDefault();
    const point = cellFromPointer(event);
    if (point) appendCellToPath(point);
  };
  const finishPath = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (!pathActiveRef.current) return;
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    submitSelectedPath();
  };
  touchApiRef.current = {
    start: (event: TouchEvent) => {
      if (!canSubmit) return;
      const touch = event.touches[0];
      if (!touch) return;
      const point = cellFromClient(touch.clientX, touch.clientY, event.target);
      if (!point) return;
      event.preventDefault();
      pathActiveRef.current = true;
      syncPath([point]);
    },
    move: (event: TouchEvent) => {
      if (!pathActiveRef.current || !canSubmit) return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      const point = cellFromClient(touch.clientX, touch.clientY, event.target);
      if (point) appendCellToPath(point);
    },
    end: (event: TouchEvent) => {
      if (!pathActiveRef.current) return;
      event.preventDefault();
      submitSelectedPath();
    },
    cancel: (event: TouchEvent) => {
      event.preventDefault();
      clearWordPath();
      setWord("");
    }
  };
  return (
    <div className="word-hunt-table" role="group" aria-label="Word Hunt board">
      <div className="word-hunt-header">
        {(["p1", "p2"] as PlayerMark[]).map((mark) => (
          <span className={currentMark === mark ? "active" : ""} key={mark}>
            {playerNameFor(room.gameId, mark)} <strong>{meta.scores[mark]}</strong>
          </span>
        ))}
        <span className={remainingSeconds <= 10 ? "timer danger" : "timer"}>
          Time <strong>{formatClock(remainingSeconds)}</strong>
        </span>
        <span>
          Found <strong>{foundCount}/{meta.words.length}</strong>
        </span>
      </div>
      <div
        className={`word-grid ${canSubmit ? "can-select" : "locked"}`}
        ref={gridRef}
        style={{ "--word-size": meta.size } as CSSProperties}
        onPointerDown={beginPath}
        onPointerMove={movePath}
        onPointerUp={finishPath}
        onPointerCancel={(event) => {
          if (event.pointerType === "touch") return;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          clearWordPath();
          setWord("");
        }}
      >
        {meta.letters.flatMap((row, rowIndex) =>
          row.map((letter, columnIndex) => {
            const key = `${rowIndex}-${columnIndex}`;
            const selected = selectedKeys.has(wordCellKey({ row: rowIndex, column: columnIndex }));
            const lastSelected = selectedCells.at(-1)?.row === rowIndex && selectedCells.at(-1)?.column === columnIndex;
            return (
              <button
                className={`${selected ? "selected" : ""} ${lastSelected ? "path-last" : ""}`}
                type="button"
                aria-label={`Letter ${letter} at ${rowIndex + 1}, ${columnIndex + 1}`}
                disabled={!canSubmit}
                data-word-cell="true"
                data-row={rowIndex}
                data-column={columnIndex}
                onPointerEnter={() => {
                  if (pathActiveRef.current && canSubmit) appendCellToPath({ row: rowIndex, column: columnIndex });
                }}
                key={key}
              >
                {letter}
              </button>
            );
          })
        )}
      </div>
      <form className="word-entry" onSubmit={submitWord}>
        <label htmlFor="word-hunt-input">Word</label>
        <input
          id="word-hunt-input"
          value={selectedWord || word}
          disabled={!canSubmit}
          autoCapitalize="characters"
          onChange={(event) => {
            clearWordPath();
            setWord(event.target.value);
          }}
          placeholder={currentMark ? remainingMs > 0 ? "TYPE WORD" : "TIME UP" : "WATCHING"}
        />
        <button className="primary-button" type="submit" disabled={!canSubmit || word.trim().length < 2}>Find</button>
      </form>
      <div className="word-hunt-side">
        <div className="word-list" aria-label="Words found">
          {meta.words.map((target) => (
            <span className={found.has(target) ? "found" : ""} key={target}>
              {found.has(target) ? target : "•".repeat(Math.min(6, target.length))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function wordCellKey(point: BoardPoint): string {
  return `${point.row},${point.column}`;
}

function CupPongBoard({
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
  const meta = room.meta?.cupPong;
  if (!meta) return null;
  const targetMark = currentMark ? (currentMark === "p1" ? "p2" : "p1") : room.turn === "p1" ? "p2" : "p1";
  const targetCups = meta.cups[targetMark] ?? [];
  const firstLiveTarget = targetCups.findIndex(Boolean);
  const [selectedCup, setSelectedCup] = useState(firstLiveTarget >= 0 ? firstLiveTarget : 0);
  const [drag, setDrag] = useState({ active: false, aim: 0, power: 0, pullX: 0, pullY: 0 });
  const dragRef = useRef(drag);
  const padRef = useRef<HTMLDivElement | null>(null);
  const targetLive = Boolean(targetCups[selectedCup]);
  const canThrow = canMove && targetLive && !room.winner;
  const lastThrow = meta.lastThrow;
  const targetPlayerName = playerNameFor(room.gameId, targetMark);
  const shooterName = playerNameFor(room.gameId, room.turn);
  const accuracy = Math.round((drag.active ? 1 - (Math.abs(drag.power - 0.5) * 0.9 + Math.abs(drag.aim) * 0.55) : lastThrow?.accuracy ?? 0) * 100);

  useEffect(() => {
    const nextLive = targetCups[selectedCup] ? selectedCup : firstLiveTarget;
    if (nextLive >= 0 && nextLive !== selectedCup) setSelectedCup(nextLive);
  }, [firstLiveTarget, selectedCup, targetCups]);

  const updateDrag = useCallback((clientX: number, clientY: number, active = true) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return { aim: 0, power: 0, pullX: 0, pullY: 0 };
    const originX = rect.left + rect.width / 2;
    const originY = rect.bottom - 34;
    const maxX = Math.max(86, rect.width * 0.34);
    const maxY = Math.max(130, rect.height * 0.72);
    const pullX = Math.max(-maxX, Math.min(maxX, clientX - originX));
    const pullY = Math.max(0, Math.min(maxY, originY - clientY));
    const aim = pullX / maxX;
    const power = pullY / maxY;
    const next = { active, aim, power, pullX, pullY };
    dragRef.current = next;
    setDrag(next);
    return next;
  }, []);

  const resetDrag = useCallback(() => {
    const next = { active: false, aim: 0, power: 0, pullX: 0, pullY: 0 };
    dragRef.current = next;
    setDrag(next);
  }, []);

  const beginThrow = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canThrow) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browser automation and mobile browsers do not retain capture for synthetic input.
    }
    updateDrag(event.clientX, event.clientY);
  }, [canThrow, updateDrag]);

  const moveThrow = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const pressed = event.buttons > 0;
    if (!canThrow || (!dragRef.current.active && !pressed)) return;
    event.preventDefault();
    updateDrag(event.clientX, event.clientY);
  }, [canThrow, updateDrag]);

  const finishThrow = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    event.preventDefault();
    const shot = updateDrag(event.clientX, event.clientY, false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released on some mobile browsers.
    }
    if (!canThrow || shot.power < 0.08) {
      resetDrag();
      return;
    }
    onMove({
      column: selectedCup,
      power: Math.max(0, Math.min(1, Number(shot.power.toFixed(3)))),
      aim: Math.max(-1, Math.min(1, Number(shot.aim.toFixed(3))))
    });
    window.setTimeout(resetDrag, 240);
  }, [canThrow, onMove, resetDrag, selectedCup, updateDrag]);

  return (
    <div
      className={`cup-pong-table ${drag.active ? "aiming" : ""} ${lastThrow ? lastThrow.made ? "shot-made" : "shot-missed" : ""}`}
      role="group"
      aria-label="Cup Pong table"
      style={{
        "--cup-aim": drag.aim,
        "--cup-power": drag.power,
        "--cup-pull-x": `${drag.pullX}px`,
        "--cup-pull-y": `${drag.pullY}px`
      } as CSSProperties}
    >
      <ThreeGameScene
        kind="cup-pong"
        stateKey={`${meta.made.p1}-${meta.made.p2}-${lastThrow?.target ?? "none"}-${lastThrow?.made ?? "none"}`}
        intensity={lastThrow ? lastThrow.made ? 1 : 0.35 : 0}
      />
      <div className="cup-pong-hud">
        <span><strong>{meta.made.p1}</strong> Blue</span>
        <span>{meta.ballsRemaining} ball{meta.ballsRemaining === 1 ? "" : "s"}</span>
        <span>Red <strong>{meta.made.p2}</strong></span>
      </div>
      <CupRack
        label={playerNameFor(room.gameId, "p2")}
        cups={meta.cups.p2}
        active={targetMark === "p2"}
        canMove={canMove && targetMark === "p2"}
        selectedCup={targetMark === "p2" ? selectedCup : null}
        lastThrow={lastThrow}
        mark="p2"
        lastMove={lastMove}
        onSelect={setSelectedCup}
      />
      <div className="cup-shot-lane">
        <div className="cup-shot-status">
          <strong>{room.winner ? "Rack cleared" : canMove ? `Target ${targetPlayerName}` : `${shooterName} lining up`}</strong>
          <span>{lastThrow ? `${lastThrow.made ? "Sank" : "Missed"} cup ${lastThrow.target + 1}` : "Line up shot"}</span>
        </div>
        <div
          className="cup-throw-pad"
          ref={padRef}
          role="button"
          tabIndex={canThrow ? 0 : -1}
          aria-disabled={!canThrow}
          aria-label={canThrow ? `Throw at cup ${selectedCup + 1}` : "Waiting for turn"}
          onPointerDown={beginThrow}
          onPointerMove={moveThrow}
          onPointerUp={finishThrow}
          onPointerCancel={resetDrag}
          onKeyDown={(event) => {
            if (!canThrow || event.key !== " ") return;
            event.preventDefault();
            onMove({ column: selectedCup, power: 0.5, aim: 0 });
          }}
        >
          <div className="cup-arc" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="cup-power-track" aria-hidden="true">
            <span />
          </div>
          <div className="cup-accuracy-chip" aria-hidden="true">{Math.max(0, Math.min(100, accuracy))}%</div>
          <div className="cup-ball cup-ball-control" aria-hidden="true" />
        </div>
      </div>
      <CupRack
        label={playerNameFor(room.gameId, "p1")}
        cups={meta.cups.p1}
        active={targetMark === "p1"}
        canMove={canMove && targetMark === "p1"}
        selectedCup={targetMark === "p1" ? selectedCup : null}
        lastThrow={lastThrow}
        mark="p1"
        lastMove={lastMove}
        onSelect={setSelectedCup}
      />
      {meta.redemption.active ? <div className="cup-redemption">Redemption shots</div> : null}
    </div>
  );
}

function CupRack({
  label,
  cups,
  active,
  canMove,
  selectedCup,
  lastThrow,
  mark,
  lastMove,
  onSelect
}: {
  label: string;
  cups: boolean[];
  active: boolean;
  canMove: boolean;
  selectedCup: number | null;
  lastThrow?: { shooter: PlayerMark; target: number; made: boolean } | null;
  mark: PlayerMark;
  lastMove: AppliedMove | null;
  onSelect: (index: number) => void;
}) {
  const lastTarget = lastThrow && (lastThrow.shooter === "p1" ? "p2" : "p1") === mark ? lastThrow.target : null;
  return (
    <div className={active ? "cup-rack active" : "cup-rack"} aria-label={label}>
      <strong>{label}</strong>
      <div className={`cup-rack-grid cups-${cups.length}`}>
        {cups.map((live, index) => (
          <button
            className={`${live ? "live" : "gone"} ${selectedCup === index ? "selected" : ""} ${lastTarget === index ? lastThrow?.made ? "made-shot" : "missed-shot" : ""} ${lastMove?.column === index ? "last-move" : ""}`}
            type="button"
            disabled={!canMove || !live}
            aria-label={`${label} cup ${index + 1}`}
            onClick={() => onSelect(index)}
            key={index}
          />
        ))}
      </div>
    </div>
  );
}

function DominoesBoard({
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
  const meta = room.meta?.dominoes;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(null);
  }, [room.moveCount, currentMark, room.roomId]);

  if (!meta) return null;
  const hand = currentMark ? meta.hands[currentMark] ?? [] : [];
  const legalSidesByIndex = new Map<number, Set<"left" | "right">>();
  hand.forEach((tile, index) => {
    const sides = legalDominoSides(meta, tile);
    if (sides.size > 0) legalSidesByIndex.set(index, sides);
  });
  const selectedSides = selectedIndex === null ? new Set<"left" | "right">() : legalSidesByIndex.get(selectedIndex) ?? new Set();
  const selectedTile = selectedIndex === null ? undefined : hand[selectedIndex];
  const canPass = canMove && legalSidesByIndex.size === 0;
  const teamMode = meta.gameMode !== "free-for-all";
  const tableMode = teamMode ? "Partners" : "Free-for-all";

  return (
    <div className={`domino-table ${meta.gameMode}`} role="group" aria-label="Dominoes table">
      <div className="domino-score-strip">
        {teamMode ? (
          <>
            <span className="team-score northSouth">Team 1 + 3 <strong>{meta.teamScores.northSouth}</strong></span>
            <span className="domino-target">Round {meta.round} · {tableMode} · first to {meta.targetScore}</span>
            <span className="team-score eastWest">Team 2 + 4 <strong>{meta.teamScores.eastWest}</strong></span>
          </>
        ) : (
          <>
            {meta.playerOrder.map((mark) => (
              <span className={room.turn === mark && !room.winner ? "team-score active" : "team-score"} key={mark}>
                {playerNameFor(room.gameId, mark)} <strong>{meta.scores[mark]}</strong>
              </span>
            ))}
            <span className="domino-target">Round {meta.round} · {tableMode} · first to {meta.targetScore}</span>
          </>
        )}
      </div>

      <div className="domino-arena">
        <DominoSeat room={room} mark="p3" currentMark={currentMark} meta={meta} position="top" />
        <DominoSeat room={room} mark="p2" currentMark={currentMark} meta={meta} position="left" />

        <div className="domino-center">
          <div className="domino-table-badge">
            <strong>{room.winner ? "Match complete" : `${playerNameFor(room.gameId, room.turn)} to move`}</strong>
            <span>{meta.drawMode === "draw" ? `${meta.deck.length} in boneyard` : "Block table"}</span>
          </div>
          <div className="domino-line-label">
            <strong>Line of play</strong>
            <span>{meta.chain.length} tiles down</span>
          </div>
          <div className="domino-chain" aria-label="Domino chain">
            {meta.chain.length > 0 ? meta.chain.map((tile, index) => (
              <span className={`domino-chain-tile owner-${tile.owner}`} key={`${tile.id}-${index}`}>
                <DominoFace tile={tile} />
              </span>
            )) : <span className="domino-empty">Select any tile to lead the round.</span>}
          </div>
          <div className="domino-open-ends">
            <button
              type="button"
              disabled={!canMove || !selectedTile || !selectedSides.has("left")}
              onClick={() => selectedIndex !== null && onMove({ column: selectedIndex, edge: "h" })}
            >
              Left {meta.openLeft ?? "-"}
            </button>
            <button
              type="button"
              disabled={!canMove || !selectedTile || !selectedSides.has("right")}
              onClick={() => selectedIndex !== null && onMove({ column: selectedIndex, edge: "v" })}
            >
              {meta.chain.length === 0 ? "Start chain" : `Right ${meta.openRight ?? "-"}`}
            </button>
          </div>
        </div>

        <DominoSeat room={room} mark="p4" currentMark={currentMark} meta={meta} position="right" />
        <DominoSeat room={room} mark="p1" currentMark={currentMark} meta={meta} position="bottom" />
      </div>

      <div className="domino-hand-panel">
        <div className="domino-hand-copy">
          <strong>{currentMark ? "Your hand" : "Spectator view"}</strong>
          <span>{selectedTile ? `Selected ${selectedTile.left}-${selectedTile.right}` : canMove ? "Pick a tile, then choose an open end." : "Opponent hands stay face down."}</span>
        </div>
        <div className="domino-hand" aria-label="Your domino hand">
          {hand.length > 0 ? hand.map((tile, index) => {
            const legalSides = legalSidesByIndex.get(index);
            const playable = Boolean(legalSides);
            const selected = selectedIndex === index;
            return (
            <button
              className={`${playable ? "playable" : ""} ${selected ? "selected" : ""}`}
              type="button"
              disabled={!canMove || !playable}
              aria-pressed={selected}
              aria-label={`Select ${tile.left}-${tile.right}`}
              onClick={() => setSelectedIndex(index)}
              key={tile.id}
            >
              <DominoFace tile={tile} />
            </button>
          );}) : <span className="domino-empty">{currentMark ? "Your hand is empty." : "Hands are private. Watch tile counts around the table."}</span>}
        </div>
        <button className="ghost-button domino-pass" type="button" disabled={!canPass} onClick={() => onMove({ column: -1 })}>
          {meta.drawMode === "draw" && meta.deck.length > 0 ? "Draw" : "Pass"}
        </button>
      </div>
      <div className="domino-log" aria-label="Domino log">
        {meta.lastRound ? (
          <p className="domino-round-summary">
            Round {meta.lastRound.round}: {meta.lastRound.winner === "draw" ? "draw" : `${playerNameFor(room.gameId, meta.lastRound.winner)} scored ${meta.lastRound.points}`}
          </p>
        ) : null}
        {(meta.log ?? []).slice(-3).map((item, index) => (
          <p className="domino-last" key={`${item}-${index}`}>{item}</p>
        ))}
      </div>
    </div>
  );
}

function DominoSeat({
  room,
  mark,
  currentMark,
  meta,
  position
}: {
  room: RoomSnapshot;
  mark: PlayerMark;
  currentMark?: PlayerMark;
  meta: NonNullable<RoomSnapshot["meta"]>["dominoes"];
  position: "top" | "left" | "right" | "bottom";
}) {
  if (!meta) return null;
  const player = room.players.find((candidate) => candidate.mark === mark);
  const isCurrent = mark === currentMark;
  const active = room.turn === mark && !room.winner;
  const team = mark === "p1" || mark === "p3" ? "northSouth" : "eastWest";
  return (
    <div className={`domino-seat ${position} ${mark} ${team} ${active ? "active" : ""} ${isCurrent ? "you" : ""}`}>
      <span className="domino-avatar">{player?.isBot ? "BOT" : mark.toUpperCase()}</span>
      <div>
        <strong>{player?.name ?? playerNameFor(room.gameId, mark)}</strong>
        <small>
          {meta.handCounts[mark]} tiles
          {isCurrent && meta.pipCounts[mark] ? ` · ${meta.pipCounts[mark]} pips` : ""}
        </small>
      </div>
      {active ? <span className="domino-turn-dot" aria-label="Current turn" /> : null}
    </div>
  );
}

function legalDominoSides(meta: NonNullable<RoomSnapshot["meta"]>["dominoes"], tile: DominoTile): Set<"left" | "right"> {
  const sides = new Set<"left" | "right">();
  if (!meta) return sides;
  if (meta.chain.length === 0) {
    sides.add("right");
    return sides;
  }
  if (tile.left === meta.openLeft || tile.right === meta.openLeft) sides.add("left");
  if (tile.left === meta.openRight || tile.right === meta.openRight) sides.add("right");
  return sides;
}

function DominoFace({ tile }: { tile: DominoTile }) {
  return (
    <span className="domino-face" aria-hidden="true">
      <DominoPips value={tile.left} />
      <DominoPips value={tile.right} />
    </span>
  );
}

function DominoPips({ value }: { value: number }) {
  return (
    <span className={`domino-pips pips-${value}`}>
      {Array.from({ length: value }).map((_, index) => <i key={index} />)}
    </span>
  );
}

type SnakeDirection = "up" | "down" | "left" | "right";

interface SnakeRun {
  phase: "ready" | "playing" | "lost";
  snake: BoardPoint[];
  direction: SnakeDirection;
  queuedDirection: SnakeDirection;
  queuedDirections: SnakeDirection[];
  food: BoardPoint;
  score: number;
  best: number;
}

const SNAKE_SIZE = 14;
const SNAKE_BEST_KEY = "table-sparks-snake-best";

interface ArcadePressEvent {
  currentTarget: EventTarget;
  preventDefault: () => void;
  stopPropagation: () => void;
  type: string;
}

function SnakeGame() {
  const [run, setRun] = useState<SnakeRun>(() => createSnakeRun(readBestScore(SNAKE_BEST_KEY)));
  const playfieldRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(() => {
    setRun((current) => createSnakeRun(current.best, "playing"));
  }, []);

  const turn = useCallback((direction: SnakeDirection) => {
    setRun((current) => queueSnakeTurn(current, direction));
    pulseDevice(8);
  }, []);

  const turnFromDelta = useCallback((x: number, y: number, threshold = 12) => {
    if (Math.max(Math.abs(x), Math.abs(y)) < threshold) return false;
    turn(Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up");
    return true;
  }, [turn]);

  const pressPad = useCallback((direction: SnakeDirection) => (event: ArcadePressEvent) => {
    event.preventDefault();
    event.stopPropagation();
    turn(direction);
  }, [turn]);

  useEffect(() => {
    if (run.phase !== "playing") return;
    const timer = window.setInterval(() => {
      setRun((current) => advanceSnakeRun(current));
    }, 115);
    return () => window.clearInterval(timer);
  }, [run.phase]);

  useEffect(() => {
    if (run.phase === "lost" && run.score > run.best) {
      writeBestScore(SNAKE_BEST_KEY, run.score);
      setRun((current) => ({ ...current, best: run.score }));
    }
  }, [run.best, run.phase, run.score]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = snakeDirectionFromKey(event.key);
      if (!direction || isTextInputTarget(event.target)) return;
      event.preventDefault();
      turn(direction);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [turn]);

  useEffect(() => {
    const playfield = playfieldRef.current;
    if (!playfield) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (isInteractiveControlTarget(event.target)) return;
      event.preventDefault();
      touchStartRef.current = { x: event.clientX, y: event.clientY };
    };
    const handlePointerMove = (event: PointerEvent) => {
      const startPoint = touchStartRef.current;
      if (!startPoint) return;
      event.preventDefault();
      if (turnFromDelta(event.clientX - startPoint.x, event.clientY - startPoint.y)) {
        touchStartRef.current = { x: event.clientX, y: event.clientY };
      }
    };
    const handlePointerEnd = () => {
      touchStartRef.current = null;
    };

    const options = { passive: false };
    playfield.addEventListener("pointerdown", handlePointerDown, options);
    playfield.addEventListener("pointermove", handlePointerMove, options);
    playfield.addEventListener("pointerup", handlePointerEnd);
    playfield.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      playfield.removeEventListener("pointerdown", handlePointerDown);
      playfield.removeEventListener("pointermove", handlePointerMove);
      playfield.removeEventListener("pointerup", handlePointerEnd);
      playfield.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [turnFromDelta]);

  const cells = new Map(run.snake.map((point, index) => [`${point.row},${point.column}`, index]));

  return (
    <div
      ref={playfieldRef}
      className={`snake-game ${run.phase}`}
      role="application"
      aria-label="Snake"
    >
      <div className="arcade-score">
        <span>{run.score}</span>
        <small>Best {Math.max(run.best, run.score)}</small>
      </div>
      <div className="snake-grid" aria-hidden="true">
        {Array.from({ length: SNAKE_SIZE * SNAKE_SIZE }).map((_, index) => {
          const row = Math.floor(index / SNAKE_SIZE);
          const column = index % SNAKE_SIZE;
          const snakeIndex = cells.get(`${row},${column}`);
          const isFood = run.food.row === row && run.food.column === column;
          return (
            <span
              className={`${snakeIndex === 0 ? "snake-head" : snakeIndex !== undefined ? "snake-body" : ""} ${isFood ? "snake-food" : ""}`}
              key={`${row}-${column}`}
            />
          );
        })}
      </div>
      <div className="snake-thumb-pad" role="group" aria-label="Snake thumb pad">
        <button className="pad-up" type="button" aria-label="Move up" onPointerDown={pressPad("up")} onTouchStart={pressPad("up")} onClick={pressPad("up")}><ArrowUp size={20} /></button>
        <button className="pad-left" type="button" aria-label="Move left" onPointerDown={pressPad("left")} onTouchStart={pressPad("left")} onClick={pressPad("left")}><ArrowLeft size={20} /></button>
        <span className="pad-center" aria-hidden="true" />
        <button className="pad-right" type="button" aria-label="Move right" onPointerDown={pressPad("right")} onTouchStart={pressPad("right")} onClick={pressPad("right")}><ArrowRight size={20} /></button>
        <button className="pad-down" type="button" aria-label="Move down" onPointerDown={pressPad("down")} onTouchStart={pressPad("down")} onClick={pressPad("down")}><ArrowDown size={20} /></button>
      </div>
      {run.phase !== "playing" ? (
        <button className="arcade-start" type="button" aria-label="Start snake" onClick={start}>
          <Play size={17} />
          {run.phase === "lost" ? "Again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}

export function createSnakeRun(best: number, phase: SnakeRun["phase"] = "ready"): SnakeRun {
  const snake = [
    { row: 7, column: 6 },
    { row: 7, column: 5 },
    { row: 7, column: 4 }
  ];

  return {
    phase,
    snake,
    direction: "right",
    queuedDirection: "right",
    queuedDirections: [],
    food: randomSnakeFood(snake),
    score: 0,
    best
  };
}

export function queueSnakeTurn(run: SnakeRun, direction: SnakeDirection): SnakeRun {
  if (run.phase !== "playing") return run;
  const lastQueuedDirection = run.queuedDirections.at(-1) ?? run.direction;
  if (direction === lastQueuedDirection || isOppositeSnakeDirection(direction, lastQueuedDirection)) return run;
  const queuedDirections = [...run.queuedDirections, direction].slice(0, 4);
  return {
    ...run,
    queuedDirection: queuedDirections.at(-1) ?? run.direction,
    queuedDirections
  };
}

export function advanceSnakeRun(run: SnakeRun): SnakeRun {
  if (run.phase !== "playing") return run;
  const [queuedDirection, ...remainingDirections] = run.queuedDirections;
  const direction = queuedDirection && !isOppositeSnakeDirection(queuedDirection, run.direction)
    ? queuedDirection
    : run.direction;
  const head = run.snake[0];
  const nextHead = moveSnakePoint(head, direction);
  const eats = nextHead.row === run.food.row && nextHead.column === run.food.column;
  const body = eats ? run.snake : run.snake.slice(0, -1);
  const crashed =
    nextHead.row < 0 ||
    nextHead.row >= SNAKE_SIZE ||
    nextHead.column < 0 ||
    nextHead.column >= SNAKE_SIZE ||
    body.some((point) => point.row === nextHead.row && point.column === nextHead.column);

  if (crashed) return { ...run, phase: "lost", direction, queuedDirection: direction, queuedDirections: [] };

  const snake = [nextHead, ...body];
  const score = run.score + (eats ? 1 : 0);
  return {
    ...run,
    snake,
    direction,
    queuedDirection: remainingDirections.at(-1) ?? direction,
    queuedDirections: remainingDirections,
    score,
    food: eats ? randomSnakeFood(snake) : run.food
  };
}

function moveSnakePoint(point: BoardPoint, direction: SnakeDirection): BoardPoint {
  if (direction === "up") return { row: point.row - 1, column: point.column };
  if (direction === "down") return { row: point.row + 1, column: point.column };
  if (direction === "left") return { row: point.row, column: point.column - 1 };
  return { row: point.row, column: point.column + 1 };
}

function randomSnakeFood(snake: BoardPoint[]): BoardPoint {
  const occupied = new Set(snake.map((point) => `${point.row},${point.column}`));
  const open: BoardPoint[] = [];
  for (let row = 0; row < SNAKE_SIZE; row += 1) {
    for (let column = 0; column < SNAKE_SIZE; column += 1) {
      if (!occupied.has(`${row},${column}`)) open.push({ row, column });
    }
  }
  return open[Math.floor(Math.random() * open.length)] ?? { row: 0, column: 0 };
}

function snakeDirectionFromKey(key: string): SnakeDirection | null {
  if (key === "ArrowUp" || key.toLowerCase() === "w") return "up";
  if (key === "ArrowDown" || key.toLowerCase() === "s") return "down";
  if (key === "ArrowLeft" || key.toLowerCase() === "a") return "left";
  if (key === "ArrowRight" || key.toLowerCase() === "d") return "right";
  return null;
}

function isOppositeSnakeDirection(a: SnakeDirection, b: SnakeDirection): boolean {
  return (a === "up" && b === "down") ||
    (a === "down" && b === "up") ||
    (a === "left" && b === "right") ||
    (a === "right" && b === "left");
}

type SlideDirection = "up" | "down" | "left" | "right";

interface TwentyRun {
  phase: "ready" | "playing" | "over";
  grid: number[][];
  score: number;
  best: number;
}

const TWENTY_SIZE = 4;
const TWENTY_BEST_KEY = "table-sparks-2048-best";

function TwentyFortyEightGame() {
  const [run, setRun] = useState<TwentyRun>(() => createTwentyRun(readBestScore(TWENTY_BEST_KEY), "ready"));

  const start = useCallback(() => {
    setRun((current) => createTwentyRun(current.best, "playing"));
  }, []);

  const move = useCallback((direction: SlideDirection) => {
    setRun((current) => moveTwentyRun(current, direction));
  }, []);

  useEffect(() => {
    if (run.phase === "over" && run.score > run.best) {
      writeBestScore(TWENTY_BEST_KEY, run.score);
      setRun((current) => ({ ...current, best: run.score }));
    }
  }, [run.best, run.phase, run.score]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = twentyDirectionFromKey(event.key);
      if (!direction || isTextInputTarget(event.target)) return;
      event.preventDefault();
      move(direction);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  return (
    <div className={`twenty-game ${run.phase}`} role="application" aria-label="2048">
      <div className="arcade-score">
        <span>{run.score}</span>
        <small>Best {Math.max(run.best, run.score)}</small>
      </div>
      <div className="twenty-board" role="group" aria-label="2048 board">
        {run.grid.flatMap((row, rowIndex) =>
          row.map((value, columnIndex) => (
            <span className={value ? `tile value-${value}` : "tile"} key={`${rowIndex}-${columnIndex}`}>
              {value || ""}
            </span>
          ))
        )}
      </div>
      <div className="snake-controls twenty-controls" aria-label="2048 controls">
        <button type="button" aria-label="Slide up" onClick={() => move("up")}><ArrowUp size={18} /></button>
        <button type="button" aria-label="Slide left" onClick={() => move("left")}><ArrowLeft size={18} /></button>
        <button type="button" aria-label="Slide down" onClick={() => move("down")}><ArrowDown size={18} /></button>
        <button type="button" aria-label="Slide right" onClick={() => move("right")}><ArrowRight size={18} /></button>
      </div>
      {run.phase !== "playing" ? (
        <button className="arcade-start" type="button" aria-label="Start 2048" onClick={start}>
          <Play size={17} />
          {run.phase === "over" ? "Again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}

function createTwentyRun(best: number, phase: TwentyRun["phase"]): TwentyRun {
  const grid = addRandomTwentyTile(addRandomTwentyTile(emptyTwentyGrid()));
  return { phase, grid, score: 0, best };
}

function moveTwentyRun(run: TwentyRun, direction: SlideDirection): TwentyRun {
  if (run.phase !== "playing") return run;
  const moved = slideTwentyGrid(run.grid, direction);
  if (!moved.changed) return run;
  const grid = addRandomTwentyTile(moved.grid);
  const score = run.score + moved.score;
  return {
    ...run,
    grid,
    score,
    phase: hasTwentyMoves(grid) ? "playing" : "over"
  };
}

function emptyTwentyGrid(): number[][] {
  return Array.from({ length: TWENTY_SIZE }, () => Array.from<number>({ length: TWENTY_SIZE }).fill(0));
}

function addRandomTwentyTile(grid: number[][]): number[][] {
  const open: BoardPoint[] = [];
  for (let row = 0; row < TWENTY_SIZE; row += 1) {
    for (let column = 0; column < TWENTY_SIZE; column += 1) {
      if (!grid[row][column]) open.push({ row, column });
    }
  }
  if (open.length === 0) return grid;
  const point = open[Math.floor(Math.random() * open.length)];
  const next = grid.map((row) => [...row]);
  next[point.row][point.column] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideTwentyGrid(grid: number[][], direction: SlideDirection): { grid: number[][]; score: number; changed: boolean } {
  const next = emptyTwentyGrid();
  let score = 0;
  let changed = false;

  for (let index = 0; index < TWENTY_SIZE; index += 1) {
    const line = direction === "left" || direction === "right"
      ? grid[index]
      : grid.map((row) => row[index]);
    const workingLine = direction === "right" || direction === "down" ? [...line].reverse() : [...line];
    const merged = mergeTwentyLine(workingLine);
    const output = direction === "right" || direction === "down" ? merged.line.reverse() : merged.line;
    score += merged.score;

    output.forEach((value, lineIndex) => {
      if (direction === "left" || direction === "right") next[index][lineIndex] = value;
      else next[lineIndex][index] = value;
      const original = direction === "left" || direction === "right" ? grid[index][lineIndex] : grid[lineIndex][index];
      if (original !== value) changed = true;
    });
  }

  return { grid: next, score, changed };
}

function mergeTwentyLine(line: number[]): { line: number[]; score: number } {
  const compact = line.filter(Boolean);
  const merged: number[] = [];
  let score = 0;
  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const value = compact[index] * 2;
      merged.push(value);
      score += value;
      index += 1;
    } else {
      merged.push(compact[index]);
    }
  }
  while (merged.length < TWENTY_SIZE) merged.push(0);
  return { line: merged, score };
}

function hasTwentyMoves(grid: number[][]): boolean {
  if (grid.some((row) => row.some((value) => value === 0))) return true;
  return grid.some((row, rowIndex) =>
    row.some((value, columnIndex) =>
      grid[rowIndex + 1]?.[columnIndex] === value ||
      row[columnIndex + 1] === value
    )
  );
}

function twentyDirectionFromKey(key: string): SlideDirection | null {
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  return null;
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
const FLAPPY_GAP = 186;
const FLAPPY_GRAVITY = 820;
const FLAPPY_LIFT = -330;
const FLAPPY_PIPE_SPEED = 126;
const FLAPPY_PIPE_SPACING = 238;
const FLAPPY_FIRST_PIPE_X = FLAPPY_WIDTH + 170;
const FLAPPY_BEST_KEY = "table-sparks-flappy-best";

function FlappyBirdGame() {
  const [run, setRun] = useState<FlappyRun>(() => createFlappyRun(readFlappyBest()));
  const playfieldRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const nextPipeIdRef = useRef(2);
  const phaseRef = useRef<FlappyRun["phase"]>("ready");
  const pendingFlapRef = useRef(false);
  const lastDirectInputAtRef = useRef(-Infinity);

  useEffect(() => {
    phaseRef.current = run.phase;
  }, [run.phase]);

  useEffect(() => {
    if (run.phase !== "playing") return;

    const tick = (time: number) => {
      const previous = lastFrameRef.current ?? time;
      const delta = Math.min((time - previous) / 1000, 0.034);
      lastFrameRef.current = time;
      const shouldFlap = pendingFlapRef.current;
      pendingFlapRef.current = false;
      setRun((current) => advanceFlappyRun(current, delta, nextPipeIdRef, shouldFlap));
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
      writeBestScore(FLAPPY_BEST_KEY, run.score);
      setRun((current) => ({ ...current, best: run.score }));
    }
  }, [run.best, run.phase, run.score]);

  const startRun = useCallback((best: number) => {
    nextPipeIdRef.current = 2;
    return createFlappyRun(best, "playing", FLAPPY_LIFT);
  }, []);

  const flap = useCallback(() => {
    pendingFlapRef.current = true;
    setRun((current) => {
      if (current.phase !== "playing") return current;
      return { ...current, velocity: FLAPPY_LIFT };
    });
  }, []);

  const triggerFlap = useCallback((
    source: "pointer" | "touch" | "click" | "key"
  ) => {
    if (phaseRef.current !== "playing") return;

    const now = performance.now();
    const duplicateWindow = source === "click" ? 450 : 70;
    const duplicate = now - lastDirectInputAtRef.current < duplicateWindow;
    if (duplicate) return;

    lastDirectInputAtRef.current = now;
    flap();
    pulseDevice(8);
  }, [flap]);

  const flapFromDirectInput = useCallback((event: Event, source: "pointer" | "touch" | "click") => {
    if (phaseRef.current !== "playing") return;
    if (isInteractiveControlTarget(event.target)) return;

    event.preventDefault();
    triggerFlap(source);
  }, [triggerFlap]);

  const start = useCallback((event: ArcadePressEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setRun((current) => startRun(current.best));
  }, [startRun]);

  useEffect(() => {
    const handleDocumentTouchStart = (event: TouchEvent) => {
      flapFromDirectInput(event, "touch");
    };
    const handleDocumentPointerDown = (event: PointerEvent) => {
      flapFromDirectInput(event, "pointer");
    };
    const handleDocumentClick = (event: MouseEvent) => {
      flapFromDirectInput(event, "click");
    };

    const options = { capture: true, passive: false };
    document.addEventListener("touchstart", handleDocumentTouchStart, options);
    document.addEventListener("pointerdown", handleDocumentPointerDown, options);
    document.addEventListener("click", handleDocumentClick, { capture: true });

    return () => {
      document.removeEventListener("touchstart", handleDocumentTouchStart, { capture: true });
      document.removeEventListener("pointerdown", handleDocumentPointerDown, { capture: true });
      document.removeEventListener("click", handleDocumentClick, { capture: true });
    };
  }, [flapFromDirectInput]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "ArrowUp" && event.key !== "Enter") return;
      if (isTextInputTarget(event.target)) return;
      event.preventDefault();
      triggerFlap("key");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerFlap]);

  return (
    <div
      ref={playfieldRef}
      className={`flappy-game ${run.phase}`}
      role="application"
      aria-label="Pipe Dash"
      tabIndex={0}
    >
      <div className="flappy-score" aria-label="Score">
        <span>{run.score}</span>
        <small>Best {run.best}</small>
      </div>
      <div
        className="flappy-bird-track"
        style={{ "--bird-y": `${(run.birdY / FLAPPY_HEIGHT) * 100}%` } as CSSProperties}
      >
        <div
          className="flappy-bird-sprite"
          style={{ "--bird-tilt": `${Math.max(-18, Math.min(42, run.velocity / 11))}deg` } as CSSProperties}
        >
          <span />
        </div>
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
        <button className="flappy-start" type="button" aria-label="Start run" onClick={start}>
          {run.phase === "crashed" ? "Again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}

export function createFlappyRun(
  best: number,
  phase: FlappyRun["phase"] = "ready",
  velocity = 0
): FlappyRun {
  return {
    phase,
    birdY: 250,
    velocity,
    pipes: [makePipe(FLAPPY_FIRST_PIPE_X, 1)],
    score: 0,
    best
  };
}

function advanceFlappyRun(
  run: FlappyRun,
  delta: number,
  nextPipeIdRef: { current: number },
  shouldFlap = false
): FlappyRun {
  if (run.phase !== "playing") return run;

  const startingVelocity = shouldFlap ? FLAPPY_LIFT : run.velocity;
  const velocity = startingVelocity + FLAPPY_GRAVITY * delta;
  const birdY = run.birdY + velocity * delta;
  let score = run.score;
  let pipes = run.pipes
    .map((pipe) => {
      const x = pipe.x - FLAPPY_PIPE_SPEED * delta;
      const scored = pipe.scored || x + FLAPPY_PIPE_WIDTH < FLAPPY_BIRD_X;
      if (!pipe.scored && scored) score += 1;
      return { ...pipe, x, scored };
    })
    .filter((pipe) => pipe.x > -FLAPPY_PIPE_WIDTH - 8);

  const lastPipe = pipes.at(-1);
  if (!lastPipe || lastPipe.x < FLAPPY_WIDTH - FLAPPY_PIPE_SPACING) {
    pipes = [...pipes, makePipe(FLAPPY_WIDTH + FLAPPY_PIPE_SPACING, nextPipeIdRef.current)];
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
  const insideGap = birdTop > pipe.gapTop - 5 && birdBottom < pipe.gapTop + FLAPPY_GAP + 5;
  return overlapsX && !insideGap;
}

function makePipe(x: number, id: number): FlappyPipe {
  return {
    id,
    x,
    gapTop: 92 + Math.floor(Math.random() * 238),
    scored: false
  };
}

function readFlappyBest(): number {
  return readBestScore(FLAPPY_BEST_KEY);
}

function readBestScore(key: string): number {
  try {
    const value = Number(localStorage.getItem(key) ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeBestScore(key: string, score: number): void {
  try {
    localStorage.setItem(key, String(score));
  } catch {
    // Scores are local-only polish; gameplay should continue if storage is unavailable.
  }
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, [contenteditable='true']");
}

function isInteractiveControlTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("button, a, input, textarea, select, [role='button'], [contenteditable='true']"));
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

const SOUND_PREFERENCE_KEY = "table-sparks-sound-enabled";

function readSoundPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_PREFERENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeSoundPreference(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_PREFERENCE_KEY, String(enabled));
  } catch {
    // Sound is a local preference; gameplay should not depend on storage.
  }
}

function useGameFeedback(room: RoomSnapshot, lastMove: AppliedMove | null, soundEnabled: boolean): void {
  const lastMoveIdRef = useRef<string>("");
  const lastWinnerRef = useRef(room.winner);

  useEffect(() => {
    if (!lastMove) return;
    const id = `${lastMove.player}-${lastMove.row}-${lastMove.column}-${lastMove.at}`;
    if (lastMoveIdRef.current === id) return;
    lastMoveIdRef.current = id;
    if (soundEnabled) playTableTone(room.gameId === "battleship" ? "hit" : "move");
    pulseDevice(12);
  }, [lastMove, room.gameId, soundEnabled]);

  useEffect(() => {
    if (!room.winner || lastWinnerRef.current === room.winner) {
      lastWinnerRef.current = room.winner;
      return;
    }
    lastWinnerRef.current = room.winner;
    if (soundEnabled) playTableTone(room.winner === "draw" ? "draw" : "win");
    pulseDevice(room.winner === "draw" ? 18 : 34);
  }, [room.winner, soundEnabled]);
}

type FeedbackTone = "move" | "hit" | "win" | "draw";

function playTableTone(tone: FeedbackTone): void {
  try {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const frequency = tone === "win" ? 620 : tone === "hit" ? 190 : tone === "draw" ? 320 : 440;
    oscillator.type = tone === "hit" ? "square" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(tone === "win" ? 880 : frequency * 1.18, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(tone === "hit" ? 0.045 : 0.035, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (tone === "win" ? 0.22 : 0.12));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + (tone === "win" ? 0.24 : 0.14));
    window.setTimeout(() => void context.close(), tone === "win" ? 280 : 180);
  } catch {
    // Browser audio can be blocked before user activation; the visual feedback still carries the move.
  }
}

function pulseDevice(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Haptics are optional.
  }
}

function LastCardFace({ card }: { card: LastCardCard }) {
  return (
    <span className={`last-card-face ${card.color}`} aria-hidden="true">
      <span>{lastCardRankLabel(card.rank)}</span>
      <strong>{lastCardRankSymbol(card.rank)}</strong>
      <small>{lastCardColorName(card.color)}</small>
    </span>
  );
}

function lastCardPlayable(
  card: LastCardCard,
  top: LastCardCard,
  currentColor: LastCardCard["color"],
  hand: LastCardCard[] = []
): boolean {
  if (card.rank === "wild4" && hand.some((candidate) => candidate !== card && candidate.color === currentColor)) {
    return false;
  }
  return card.color === "wild" || card.color === currentColor || card.rank === top.rank;
}

function lastCardAria(card: LastCardCard): string {
  return `${lastCardColorName(card.color)} ${lastCardRankLabel(card.rank)}`;
}

function lastCardColorName(color: LastCardCard["color"]): string {
  if (color === "red") return "red";
  if (color === "yellow") return "yellow";
  if (color === "green") return "green";
  if (color === "wild") return "wild";
  return "blue";
}

function lastCardRankLabel(rank: LastCardCard["rank"]): string {
  if (rank === "skip") return "Skip";
  if (rank === "reverse") return "Reverse";
  if (rank === "draw2") return "+2";
  if (rank === "wild") return "Wild";
  if (rank === "wild4") return "Wild +4";
  return rank;
}

function lastCardRankSymbol(rank: LastCardCard["rank"]): string {
  if (rank === "skip") return "S";
  if (rank === "reverse") return "R";
  if (rank === "draw2") return "+2";
  if (rank === "wild") return "W";
  if (rank === "wild4") return "+4";
  return rank;
}

function lastCardIsAction(rank: LastCardCard["rank"]): boolean {
  return rank === "skip" || rank === "reverse" || rank === "draw2" || rank === "wild" || rank === "wild4";
}

function lastCardIsWildAction(rank: LastCardCard["rank"]): boolean {
  return rank === "wild" || rank === "wild4";
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
  if (gameId === "last-card") return "Match the top card by color or rank. Skips and reverses bounce the turn, +2 draws two, and Wild +4 is only for hands with no active-color card.";
  if (gameId === "darts") return "Take three throws per turn and finish exactly on a double.";
  if (gameId === "word-hunt") return "Find as many connected words as you can before the timer ends. Longer words score more, and each word can be claimed once.";
  if (gameId === "cup-pong") return "Pick an opponent cup to sink it. Clear the other rack before yours disappears.";
  if (gameId === "dominoes") return "Play a tile that matches either open end. Draw when stuck; lowest pips wins if everyone passes.";
  if (gameId === "flappy-bird") return "Thread the flyer through shifting pipe gaps and chase a clean high score.";
  if (gameId === "snake") return "Steer through the grid, eat food, and avoid the walls and your own tail.";
  if (gameId === "twenty-forty-eight") return "Slide matching number tiles together until the board runs out of moves.";
  return "Place nine pieces, form mills of three, then slide pieces and remove opponent pieces.";
}

function botPersonality(difficulty: BotDifficulty, gameId: GameId): string {
  if (difficulty === "casual") return "Loose and playful. It sees obvious wins but leaves room for drama.";
  if (difficulty === "sharp") return "Tactical and alert. It blocks threats and builds pressure.";
  if (gameId === "last-card") return "Color-card shark. It saves wilds for awkward moments and keeps the table color uncomfortable.";
  if (gameId === "darts") return "Checkout hunter. It aims for clean triples and avoids wasting darts near zero.";
  if (gameId === "word-hunt") return "Timed word racer. It keeps hunting while you type and favors longer finds on harder modes.";
  if (gameId === "cup-pong") return "Cup closer. It pressures the middle of the rack and finishes clean.";
  if (gameId === "dominoes") return "Pip counter. It burns heavy tiles early and keeps matching numbers alive.";
  return gameId === "battleship"
    ? "Cold sonar mode. It hunts patterns and celebrates every hit internally."
    : "Ruthless table brain. It searches for wins, blocks traps, and prefers center control.";
}
