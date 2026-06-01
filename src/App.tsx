import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BotDifficulty, BoardVariant, GameId, GameMove } from "./shared/games";
import { isGameId } from "./shared/games";
import type { ClientMessage, RoomSnapshot, ServerMessage } from "./shared/protocol";
import { GameRoomView } from "./ui/GameRoomView";
import { Lobby } from "./ui/Lobby";

const TOKEN_KEY = "table-sparks-guest-token";
const NAME_KEY = "table-sparks-guest-name";
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "") ?? "";

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [creatingGameId, setCreatingGameId] = useState<GameId | null>(null);
  const [guestName, setGuestName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");

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
      options: { opponent: "friend" | "bot"; botDifficulty: BotDifficulty } = {
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
      void createRoom(gameId);
    }
  }, [createRoom, creatingGameId, newGameMatch]);

  const roomMatch = path.match(/^\/room\/([^/]+)$/);
  if (roomMatch) {
    return (
      <RoomRoute
        roomId={roomMatch[1]}
        guestName={guestName}
        onSetGuestName={(name) => {
          localStorage.setItem(NAME_KEY, name);
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
            <span className="brand-mark">TS</span>
            <span>Table Sparks</span>
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
  const [copiedInvite, setCopiedInvite] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const errorTimerRef = useRef<number | null>(null);

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
    const socket = new WebSocket(socketUrl(roomId));
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "join", guestToken, name: guestName }));
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if ("room" in message && message.room) {
        setRoom(message.room);
        setError(null);
      }
      if (message.type === "error") showError(message.reason);
    });

    socket.addEventListener("close", () => {
      if (intentionallyClosed) return;
      showError("Connection closed. Refresh to rejoin the table.");
    });

    socket.addEventListener("error", () => {
      if (intentionallyClosed) return;
      showError("The realtime connection tripped. Refresh to reconnect.");
    });

    return () => {
      intentionallyClosed = true;
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [guestName, guestToken, roomId, showError]);

  const inviteUrl = `${window.location.origin}/room/${roomId}`;

  if (!room) {
    return (
      <main className="loading-room">
        <div className="loading-token">Table Sparks</div>
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
        inviteUrl={inviteUrl}
        copiedInvite={copiedInvite}
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
      />
    </>
  );
}

function getGuestToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing) return existing;

  const token = crypto.randomUUID();
  localStorage.setItem(TOKEN_KEY, token);
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

function apiUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}
