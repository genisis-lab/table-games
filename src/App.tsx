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
  const [createError, setCreateError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState(() => readLocalStorage(NAME_KEY) ?? "");
  const lastDirectAttemptRef = useRef<string | null>(null);

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
      setCreateError(null);
      try {
        const response = await fetch(apiUrl("/api/rooms"), {
          method: "POST",
          body: JSON.stringify({ gameId, ...options }),
          headers: { "content-type": "application/json" }
        });

        if (!response.ok) {
          const failure = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(failure.error ?? "The table service did not accept the room.");
        }

        const room = (await response.json()) as { invitePath: string };
        setCreatingGameId(null);
        navigate(room.invitePath);
        return true;
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : "Could not create the room. Check your connection and try again.");
        return false;
      } finally {
        setCreatingGameId(null);
      }
    },
    [navigate]
  );

  const newGameMatch = path.match(/^\/new\/([^/]+)$/);
  useEffect(() => {
    const gameId = newGameMatch?.[1];
    if (gameId && isGameId(gameId) && !creatingGameId) {
      const attemptKey = `${gameId}${window.location.search}`;
      if (lastDirectAttemptRef.current === attemptKey) return;
      lastDirectAttemptRef.current = attemptKey;
      void createRoom(gameId, createRoomOptionsFromSearch(gameId, window.location.search));
    }
  }, [createRoom, creatingGameId, newGameMatch]);

  const directGameId = newGameMatch?.[1];
  if (directGameId && isGameId(directGameId) && createError && !creatingGameId) {
    return (
      <main className="join-screen">
        <section className="join-panel create-error-panel" role="alert">
          <div className="brand-lockup"><span className="brand-mark">TG</span><span>Table Games</span></div>
          <h1>The table did not open.</h1>
          <p>{createError}</p>
          <div className="join-actions">
            <button type="button" className="ghost-button" onClick={() => navigate("/")}>Back to games</button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                lastDirectAttemptRef.current = `${directGameId}${window.location.search}`;
                setCreateError(null);
                void createRoom(directGameId, createRoomOptionsFromSearch(directGameId, window.location.search));
              }}
            >
              Try again
            </button>
          </div>
        </section>
      </main>
    );
  }

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

  return (
    <>
      {createError ? <div className="toast" role="alert">{createError}</div> : null}
      <Lobby onCreateRoom={createRoom} creatingGameId={creatingGameId} />
    </>
  );
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
  const [connectionNonce, setConnectionNonce] = useState(0);
  const [initialConnectionError, setInitialConnectionError] = useState<string | null>(null);
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
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      showError("The table is reconnecting. Try that action again when it is live.");
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }, [showError]);

  useEffect(() => {
    let intentionallyClosed = false;
    let reconnectAttempt = 0;
    let snapshotTimer: number | null = null;
    let hasSnapshot = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const clearSnapshotTimer = () => {
      if (snapshotTimer) window.clearTimeout(snapshotTimer);
      snapshotTimer = null;
    };

    const connect = () => {
      if (intentionallyClosed) return;
      clearReconnectTimer();
      setConnectionStatus((current) => current === "connected" ? "reconnecting" : "connecting");

      let socket: WebSocket;
      try {
        socket = new WebSocket(socketUrl(roomId));
      } catch {
        setInitialConnectionError("This table could not be reached.");
        setConnectionStatus("reconnecting");
        reconnectTimerRef.current = window.setTimeout(connect, reconnectDelayForAttempt(reconnectAttempt++));
        return;
      }
      socketRef.current = socket;
      clearSnapshotTimer();
      snapshotTimer = window.setTimeout(() => {
        if (!hasSnapshot) setInitialConnectionError("The table did not send its first update. Check the link and try again.");
      }, 8000);

      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
        setConnectionStatus("connected");
        setError(null);
        setInitialConnectionError(null);
        socket.send(JSON.stringify({ type: "join", guestToken, name: guestName }));
      });

      socket.addEventListener("message", (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          showError("The table sent an unreadable update.");
          return;
        }
        if ("room" in message && message.room) {
          hasSnapshot = true;
          clearSnapshotTimer();
          setRoom(message.room);
          setInitialConnectionError(null);
          setConnectionStatus("connected");
        }
        if (message.type === "move_applied") setLastMove(message.move);
        if (message.type === "error") showError(message.reason);
      });

      socket.addEventListener("close", () => {
        if (intentionallyClosed) return;
        clearSnapshotTimer();
        if (socketRef.current === socket) socketRef.current = null;
        setConnectionStatus("reconnecting");
        if (!hasSnapshot) setInitialConnectionError("This table is unavailable or the invite link is no longer valid.");
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
      clearSnapshotTimer();
      document.removeEventListener("visibilitychange", reconnectIfVisible);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connectionNonce, guestName, guestToken, roomId, showError]);

  const inviteUrl = `${window.location.origin}/room/${roomId}`;

  if (!room) {
    return (
      <main className="loading-room">
        <div className="loading-token">Table Games</div>
        {initialConnectionError ? (
          <section className="loading-room-error" role="alert">
            <strong>The table did not open.</strong>
            <p>{initialConnectionError}</p>
            <div className="join-actions">
              <a className="ghost-button" href="/">Back to games</a>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setInitialConnectionError(null);
                  setConnectionStatus("connecting");
                  setConnectionNonce((value) => value + 1);
                }}
              >
                Try again
              </button>
            </div>
          </section>
        ) : <p>Pulling up the chairs...</p>}
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
          try {
            await copyText(inviteUrl);
            setCopiedInvite(true);
            window.setTimeout(() => setCopiedInvite(false), 1400);
          } catch {
            showError("Copy was blocked. Select the invite link and copy it manually.");
          }
        }}
        onMove={(move: GameMove) => send({
          type: "make_move",
          move,
          commandId: crypto.randomUUID(),
          expectedRevision: room.revision ?? 0
        })}
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

export async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
  await navigator.clipboard.writeText(value);
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
