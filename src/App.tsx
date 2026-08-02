import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BotDifficulty, BoardVariant, GameId, GameMove } from "./shared/games";
import { canBotStart, isBoardVariantForGame, isBotDifficulty, isGameId } from "./shared/games";
import type { AppliedMove, ClientMessage, RoomSnapshot, ServerMessage } from "./shared/protocol";
import { GameRoomView } from "./ui/GameRoomView";
import { Lobby } from "./ui/Lobby";

const TOKEN_KEY = "table-sparks-guest-token";
const NAME_KEY = "table-sparks-guest-name";
const DEPLOYED_WORKER_ORIGIN = "https://table-sparks.neil27.workers.dev";
const API_ORIGIN = resolveApiOrigin(window.location.hostname, import.meta.env.VITE_API_ORIGIN);

export type ConnectionStatus = "connecting" | "connected" | "reconnecting";

export interface CreateRoomOptions {
  opponent: "friend" | "bot";
  botDifficulty: BotDifficulty;
  boardVariant?: BoardVariant;
  botStarts?: boolean;
}

export function resolveApiOrigin(hostname: string, envOrigin?: string): string {
  const cleanEnvOrigin = envOrigin?.replace(/\/$/, "") ?? "";
  if (cleanEnvOrigin) return cleanEnvOrigin;
  if (hostname === "table.builtwai.com") return "";
  if (hostname === "table-sparks-game.pages.dev" || hostname.endsWith(".table-sparks-game.pages.dev")) {
    return DEPLOYED_WORKER_ORIGIN;
  }
  return "";
}

export function createRoomOptionsFromSearch(gameId: GameId, search: string): CreateRoomOptions {
  const params = new URLSearchParams(search);
  const opponent = params.get("opponent") === "bot" ? "bot" : "friend";
  const rawDifficulty = params.get("botDifficulty") ?? params.get("difficulty");
  const botDifficulty = rawDifficulty && isBotDifficulty(rawDifficulty) ? rawDifficulty : "ruthless";
  const rawVariant = params.get("boardVariant") ?? params.get("variant");
  const boardVariant = rawVariant && isBoardVariantForGame(gameId, rawVariant) ? rawVariant : undefined;
  const botStarts = canBotStart(gameId) && ["1", "true", "yes"].includes((params.get("botStarts") ?? "").toLowerCase());
  return { opponent, botDifficulty, boardVariant, botStarts };
}

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [creatingGameId, setCreatingGameId] = useState<GameId | null>(null);
  const [guestName, setGuestName] = useState(() => readLocalStorage(NAME_KEY) ?? "");

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
  }, []);

  const createRoom = useCallback(
    async (
      gameId: GameId,
      options: CreateRoomOptions = {
        opponent: "friend",
        botDifficulty: "ruthless"
      }
    ) => {
      setCreatingGameId(gameId);
      const response = await fetch(apiUrl("/api/rooms"), {
        method: "POST",
        body: JSON.stringify({ gameId, ...options }),
        headers: { "content-type": "application/json" }
      });

      if (!response.ok) {
        setCreatingGameId(null);
        return;
      }

      const room = (await response.json()) as { invitePath: string };
      setCreatingGameId(null);
      navigate(room.invitePath);
    },
    [navigate]
  );

  const newGameMatch = path.match(/^\/new\/([^/]+)$/);
  useEffect(() => {
    const gameId = newGameMatch?.[1];
    if (gameId && isGameId(gameId) && !creatingGameId) {
      void createRoom(gameId, createRoomOptionsFromSearch(gameId, window.location.search));
    }
  }, [createRoom, creatingGameId, newGameMatch]);

  const roomMatch = path.match(/^\/room\/([^/]+)$/);
  if (roomMatch) {
    return (
      <RoomRoute
        roomId={roomMatch[1]}
        guestName={guestName}
        onSetGuestName={(name) => {
          writeLocalStorage(NAME_KEY, name);
          setGuestName(name);
        }}
        onHome={() => navigate("/")}
      />
    );
  }

  return <Lobby onCreateRoom={createRoom} creatingGameId={creatingGameId} />;
}

function RoomRoute({
  roomId,
  guestName,
  onSetGuestName,
  onHome
}: {
  roomId: string;
  guestName: string;
  onSetGuestName: (name: string) => void;
  onHome: () => void;
}) {
  const [draftName, setDraftName] = useState(guestName);

  if (!guestName) {
    return (
      <main className="join-screen">
        <section className="join-panel" aria-label="Join room">
          <div className="brand-lockup">
            <span className="brand-mark">TG</span>
            <span>Table Games</span>
          </div>
          <h1>Pick your table name.</h1>
          <p>Guest rooms are instant. No account, no lobby maze, just a name at the table.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const clean = draftName.trim().slice(0, 24);
              if (clean) onSetGuestName(clean);
            }}
          >
            <label htmlFor="guest-name">Display name</label>
            <input
              id="guest-name"
              value={draftName}
              maxLength={24}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Ruby"
            />
            <div className="join-actions">
              <button type="button" className="ghost-button" onClick={onHome}>
                Lobby
              </button>
              <button type="submit" className="primary-button">
                Join room
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return <ConnectedRoom roomId={roomId} guestName={guestName} />;
}

function ConnectedRoom({ roomId, guestName }: { roomId: string; guestName: string }) {
  const guestToken = useMemo(getGuestToken, []);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [lastMove, setLastMove] = useState<AppliedMove | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const showError = useCallback((message: string) => {
    setError(message);
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setError(null), 2400);
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    let intentionallyClosed = false;
    let reconnectAttempt = 0;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const connect = () => {
      if (intentionallyClosed) return;
      clearReconnectTimer();
      setConnectionStatus((current) => current === "connected" ? "reconnecting" : "connecting");

      const socket = new WebSocket(socketUrl(roomId));
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
        setConnectionStatus("connected");
        setError(null);
        socket.send(JSON.stringify({ type: "join", guestToken, name: guestName }));
      });

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if ("room" in message && message.room) {
          setRoom(message.room);
          setConnectionStatus("connected");
        }
        if (message.type === "move_applied") setLastMove(message.move);
        if (message.type === "error") showError(message.reason);
      });

      socket.addEventListener("close", () => {
        if (intentionallyClosed) return;
        if (socketRef.current === socket) socketRef.current = null;
        setConnectionStatus("reconnecting");
        const delay = reconnectDelayForAttempt(reconnectAttempt);
        reconnectAttempt += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      });

      socket.addEventListener("error", () => {
        if (intentionallyClosed) return;
        setConnectionStatus("reconnecting");
      });
    };

    const reconnectIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      const socket = socketRef.current;
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
      reconnectAttempt = 0;
      connect();
    };

    connect();
    document.addEventListener("visibilitychange", reconnectIfVisible);

    return () => {
      intentionallyClosed = true;
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
      clearReconnectTimer();
      document.removeEventListener("visibilitychange", reconnectIfVisible);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [guestName, guestToken, roomId, showError]);

  const inviteUrl = `${window.location.origin}/room/${roomId}`;

  if (!room) {
    return (
      <main className="loading-room">
        <div className="loading-token">Table Games</div>
        <p>Pulling up the chairs...</p>
      </main>
    );
  }

  return (
    <>
      {error ? <div className="toast" role="status">{error}</div> : null}
      <GameRoomView
        room={room}
        guestToken={guestToken}
        connectionStatus={connectionStatus}
        inviteUrl={inviteUrl}
        copiedInvite={copiedInvite}
        lastMove={lastMove}
        onCopyInvite={async () => {
          await navigator.clipboard?.writeText(inviteUrl);
          setCopiedInvite(true);
          window.setTimeout(() => setCopiedInvite(false), 1400);
        }}
        onMove={(move: GameMove) => send({ type: "make_move", move })}
        onChat={(body) => send({ type: "send_chat", body })}
        onReaction={(emoji) => send({ type: "send_reaction", emoji })}
        onRematch={() => send({ type: "request_rematch" })}
        onRequestUndo={() => send({ type: "request_undo" })}
        onClaimSeat={() => send({ type: "claim_seat" })}
        onSwitchGame={(gameId) => send({ type: "switch_game", gameId })}
        onSetBoardVariant={(variant: BoardVariant) => send({ type: "set_board_variant", variant })}
        onSetBotDifficulty={(difficulty) => send({ type: "set_bot_difficulty", difficulty })}
        onSetBotStarts={(botStarts) => send({ type: "set_bot_starts", botStarts })}
      />
    </>
  );
}

function getGuestToken(): string {
  const existing = readLocalStorage(TOKEN_KEY);
  if (existing) return existing;

  const token = crypto.randomUUID();
  writeLocalStorage(TOKEN_KEY, token);
  return token;
}

function socketUrl(roomId: string): string {
  if (API_ORIGIN) {
    const origin = new URL(API_ORIGIN);
    origin.protocol = origin.protocol === "https:" ? "wss:" : "ws:";
    origin.pathname = `/api/rooms/${roomId}/socket`;
    return origin.toString();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/rooms/${roomId}/socket`;
}

export function reconnectDelayForAttempt(attempt: number): number {
  return Math.min(4000, 350 * 2 ** Math.max(0, attempt));
}

function apiUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}

function readLocalStorage(key: string): string | null {
  try {
    return typeof localStorage.getItem === "function" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    if (typeof localStorage.setItem === "function") localStorage.setItem(key, value);
  } catch {
    // Guest identity/debug flags are convenience state; gameplay should keep running without storage.
  }
}
