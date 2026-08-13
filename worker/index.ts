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
import { GameRoom, type Env } from "./game-room";
import { PayloadTooLargeError, readJsonBody } from "./request-body";

export { GameRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestOrigin = request.headers.get("origin");
    const corsOrigin = allowedCorsOrigin(requestOrigin, env);

    try {
      if (url.pathname.startsWith("/api/") && requestOrigin && !corsOrigin) {
        return json({ error: "Origin is not allowed." }, 403);
      }

      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        return withCors(new Response(null, { status: 204 }), corsOrigin);
      }

      if (url.pathname === "/api/health") {
        return withCors(Response.json({ ok: true, service: "table-games" }), corsOrigin);
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
        const body = (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
          ? parsedBody
          : {}) as {
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

      const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(socket))?$/);
      if (roomMatch) {
        const [, roomId, socketAction] = roomMatch;
        const stub = env.ROOMS.getByName(roomId);

        if (socketAction === "socket") {
          return stub.fetch(new Request(`https://room.internal/${roomId}/socket`, request));
        }

        return withCors(await stub.fetch(new Request(`https://room.internal/${roomId}/snapshot`)), corsOrigin);
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
  return withCors(Response.json(body, { status }), origin);
}

function withCors(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("cache-control", "no-store");
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
    headers.set("access-control-allow-headers", "content-type");
    headers.set("vary", "Origin");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function allowedCorsOrigin(origin: string | null, env: Env): string | null {
  if (!origin) return null;
  const configured = (env.ALLOWED_ORIGINS ?? "https://table.builtwai.com,https://table-sparks-game.pages.dev")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.table-sparks-game\.pages\.dev$/.test(origin)) return origin;
  return null;
}

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
