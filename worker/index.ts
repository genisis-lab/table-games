import {
  canBotStart,
  isBoardVariantForGame,
  isBotDifficulty,
  isGameId,
  supportsFriendMode,
  type BoardVariant,
  type BotDifficulty,
  type GameId
} from "../src/shared/games";
import { GameRoom } from "./game-room";

export { GameRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestOrigin = request.headers.get("origin");
    const corsOrigin = requestOrigin && originAllowed(requestOrigin, url.origin, env)
      ? requestOrigin
      : null;

    try {
      if (requestOrigin && !corsOrigin && url.pathname.startsWith("/api/")) {
        return json({ error: "Origin not allowed." }, 403);
      }
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        return withApiHeaders(new Response(null, { status: 204 }), corsOrigin);
      }

      if (url.pathname === "/api/health") {
        return withApiHeaders(Response.json({ ok: true, service: "table-games" }), corsOrigin);
      }

      if (url.pathname === "/api/rooms" && request.method === "POST") {
        let parsedBody: unknown;
        try {
          parsedBody = await readJsonBody(request, 8 * 1024);
        } catch (error) {
          const oversized = error instanceof PayloadTooLargeError;
          return json(
            { error: oversized ? "Request body is too large." : "Invalid request body." },
            oversized ? 413 : 400,
            corsOrigin
          );
        }
        const body = (parsedBody && typeof parsedBody === "object" ? parsedBody : {}) as {
          gameId?: string;
          opponent?: string;
          botDifficulty?: string;
          boardVariant?: string;
          botStarts?: boolean;
        };
        if (!body.gameId || !isGameId(body.gameId)) {
          return json({ error: "Unknown game." }, 400, corsOrigin);
        }

        const opponent = supportsFriendMode(body.gameId)
          ? body.opponent === "bot" ? "bot" : "friend"
          : "bot";
        const botDifficulty = body.botDifficulty && isBotDifficulty(body.botDifficulty)
          ? body.botDifficulty
          : "ruthless";
        const boardVariant = body.boardVariant && isBoardVariantForGame(body.gameId, body.boardVariant)
          ? body.boardVariant
          : undefined;
        const botStarts = Boolean(body.botStarts) && canBotStart(body.gameId);

        const roomId = createRoomId();
        const stub = env.ROOMS.getByName(roomId);
        await stub.fetch(
          new Request(`https://room.internal/${roomId}/init`, {
            method: "POST",
            body: JSON.stringify({ gameId: body.gameId, opponent, botDifficulty, boardVariant, botStarts }),
            headers: { "content-type": "application/json" }
          })
        );

        return json(
          {
            roomId,
            gameId: body.gameId,
            opponent,
            botDifficulty,
            boardVariant,
            botStarts,
            invitePath: `/room/${roomId}`
          },
          201,
          corsOrigin
        );
      }

      const roomMatch = url.pathname.match(/^\/api\/rooms\/(room-[a-f0-9]{10})(?:\/(socket))?$/);
      if (roomMatch) {
        const [, roomId, socketAction] = roomMatch;
        const stub = env.ROOMS.getByName(roomId);

        if (socketAction === "socket") {
          if (!requestOrigin || !corsOrigin) {
            return json({ error: "A valid WebSocket origin is required." }, 403);
          }
          const response = await stub.fetch(new Request(`https://room.internal/${roomId}/socket`, request));
          return response.status === 101 ? response : withApiHeaders(response, corsOrigin);
        }

        return withApiHeaders(
          await stub.fetch(new Request(`https://room.internal/${roomId}/snapshot`)),
          corsOrigin
        );
      }

      if (url.pathname.startsWith("/api/")) {
        return json({ error: "Not found." }, 404, corsOrigin);
      }

      if ((request.method === "GET" || request.method === "HEAD") && env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Worker request failed",
          path: url.pathname,
          error: error instanceof Error ? error.message : String(error)
        })
      );
      return json({ error: "Internal server error." }, 500, corsOrigin);
    }
  }
} satisfies ExportedHandler<Env>;

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return withApiHeaders(Response.json(body, { status }), origin);
}

function withApiHeaders(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("cache-control", "no-store");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.append("vary", "Origin");
  } else {
    headers.delete("access-control-allow-origin");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function originAllowed(origin: string, requestOrigin: string, env: Env): boolean {
  let parsed: URL;
  try { parsed = new URL(origin); } catch { return false; }
  if (parsed.origin !== origin) return false;
  if (origin === requestOrigin) return true;
  const allowed = String(env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.some((entry) => {
    if (entry === origin) return true;
    const wildcard = /^(https?):\/\/\*\.(.+)$/.exec(entry);
    return Boolean(
      wildcard &&
      parsed.protocol === `${wildcard[1]}:` &&
      parsed.hostname.endsWith(`.${wildcard[2]}`)
    );
  });
}

async function readJsonBody(request: Request, limit: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > limit) throw new PayloadTooLargeError();
  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let raw = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      try { await reader.cancel(); } catch {}
      throw new PayloadTooLargeError();
    }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  return JSON.parse(raw || "{}");
}

class PayloadTooLargeError extends Error {}

function createRoomId(): string {
  return `room-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

export function createRoomRequest(
  gameId: GameId,
  opponent: "friend" | "bot" = "friend",
  botDifficulty: BotDifficulty = "ruthless",
  boardVariant?: BoardVariant,
  botStarts = false
): Request {
  return new Request("https://table-sparks.test/api/rooms", {
    method: "POST",
    body: JSON.stringify({ gameId, opponent, botDifficulty, boardVariant, botStarts }),
    headers: { "content-type": "application/json" }
  });
}
