import {
  isBoardVariantForGame,
  isBotDifficulty,
  isGameId,
  supportsFriendMode,
  type BoardVariant,
  type BotDifficulty,
  type GameId
} from "../src/shared/games";
import { GameRoom, type Env } from "./game-room";

export { GameRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        return withCors(new Response(null, { status: 204 }));
      }

      if (url.pathname === "/api/health") {
        return withCors(Response.json({ ok: true, service: "table-sparks" }));
      }

      if (url.pathname === "/api/rooms" && request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          gameId?: string;
          opponent?: string;
          botDifficulty?: string;
          boardVariant?: string;
        };
        if (!body.gameId || !isGameId(body.gameId)) {
          return json({ error: "Unknown game." }, 400);
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

        const roomId = createRoomId();
        const stub = env.ROOMS.getByName(roomId);
        await stub.fetch(
          new Request(`https://room.internal/${roomId}/init`, {
            method: "POST",
            body: JSON.stringify({ gameId: body.gameId, opponent, botDifficulty, boardVariant }),
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
            invitePath: `/room/${roomId}`
          },
          201
        );
      }

      const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(socket))?$/);
      if (roomMatch) {
        const [, roomId, socketAction] = roomMatch;
        const stub = env.ROOMS.getByName(roomId);

        if (socketAction === "socket") {
          return stub.fetch(new Request(`https://room.internal/${roomId}/socket`, request));
        }

        return withCors(await stub.fetch(new Request(`https://room.internal/${roomId}/snapshot`)));
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
      return json({ error: "Internal server error." }, 500);
    }
  }
} satisfies ExportedHandler<Env>;

function json(body: unknown, status = 200): Response {
  return withCors(Response.json(body, { status }));
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function createRoomId(): string {
  return `room-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

export function createRoomRequest(
  gameId: GameId,
  opponent: "friend" | "bot" = "friend",
  botDifficulty: BotDifficulty = "ruthless",
  boardVariant?: BoardVariant
): Request {
  return new Request("https://table-sparks.test/api/rooms", {
    method: "POST",
    body: JSON.stringify({ gameId, opponent, botDifficulty, boardVariant }),
    headers: { "content-type": "application/json" }
  });
}
