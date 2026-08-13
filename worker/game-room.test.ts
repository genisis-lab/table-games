import { SELF, evictAllDurableObjects, reset } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import worker from "./index";
import type { Env } from "./game-room";

type ServerMessage = {
  type: string;
  reason?: string;
  winner?: string;
  room?: {
    roomId: string;
    gameId: string;
    boardVariant?: string;
    turn?: string;
    revision?: number;
    moveCount?: number;
    phase?: "waiting" | "active" | "complete";
    readyAt?: number | null;
    you?: { participantId: string; role: "player" | "spectator"; mark?: string } | null;
    board: Array<Array<string | null>>;
    players: Array<{ name: string; mark: string; guestToken?: string; connected?: boolean; isBot?: boolean }>;
    spectators: Array<{ name: string; guestToken?: string }>;
    meta?: {
      lastCard?: {
        deck: unknown[];
        deckCount: number;
        discard: Array<{ color: string; rank: string }>;
        hands: { p1: unknown[]; p2: unknown[]; p3: unknown[]; p4: unknown[] };
        handCounts: { p1: number; p2: number; p3: number; p4: number };
      };
      dominoes?: {
        deck?: unknown[];
        hands: { p1: unknown[]; p2: unknown[]; p3: unknown[]; p4: unknown[] };
        handCounts: { p1: number; p2: number; p3: number; p4: number };
        pipCounts?: { p1: number; p2: number; p3: number; p4: number };
        teamScores?: { northSouth: number; eastWest: number };
        playerOrder: string[];
      };
      battleship?: {
        botFleet: unknown[];
        playerFleet: unknown[];
        botShips: unknown[];
        playerShips: unknown[];
        humanShots: Record<string, "hit" | "miss">;
        botShots: Record<string, "hit" | "miss">;
      };
      wordHunt?: {
        words: string[];
        found: { p1: string[]; p2: string[]; p3: string[]; p4: string[] };
        scores: { p1: number; p2: number; p3: number; p4: number };
      };
      chess?: {
        board: string[];
        turn: "white" | "black";
        fullmoveNumber: number;
        lastMove: { from: number; to: number; promotion: string | null } | null;
      };
      setTrio?: {
        board: Array<{ id: string; number: number; color: number; shape: number; fill: number }>;
        deckRemaining: number;
        setsAvailable: number;
        scores: { p1: number; p2: number };
        cooldowns: {
          p1: { durationMs: number; expiresAt?: number } | null;
          p2: { durationMs: number; expiresAt?: number } | null;
        };
        revision: number;
      };
    };
    chat: Array<{ body: string }>;
    moveHistory: Array<{ player: string; label: string }>;
    rematchRequests: string[];
    undoRequests: string[];
  };
  move?: { player: string; row: number; column: number };
  chat?: { body: string };
  reaction?: { emoji: string };
};

const openSockets = new Set<WebSocket>();

afterEach(async () => {
  await evictAllDurableObjects({ webSockets: "close" });
  openSockets.clear();
  await reset();
});

describe("GameRoom Durable Object", () => {
  it("rejects untrusted browser origins and never emits wildcard CORS", async () => {
    const blocked = await worker.fetch(
      new Request("https://table.builtwai.com/api/health", {
        headers: { origin: "https://attacker.example" }
      }),
      {} as Env
    );
    expect(blocked.status).toBe(403);
    expect(blocked.headers.get("cache-control")).toBe("no-store");
    expect(blocked.headers.get("x-content-type-options")).toBe("nosniff");

    const allowed = await worker.fetch(
      new Request("https://table.builtwai.com/api/health", {
        headers: { origin: "https://table.builtwai.com" }
      }),
      {} as Env
    );
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://table.builtwai.com");
    expect(allowed.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(allowed.headers.get("cache-control")).toBe("no-store");
    expect(allowed.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(allowed.headers.get("x-content-type-options")).toBe("nosniff");
    expect(allowed.headers.get("x-frame-options")).toBe("DENY");
    expect(allowed.headers.get("permissions-policy")).toContain("microphone=()");
  });

  it("rejects malformed and oversized room-creation JSON before parsing it", async () => {
    const malformed = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" }
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({ error: "Invalid request body." });

    const oversized = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "tic-tac-toe", padding: "x".repeat(8 * 1024) }),
      headers: { "content-type": "application/json" }
    });
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toMatchObject({ error: "Request body is too large." });
  });

  it("serves static assets for non-API room routes", async () => {
    const response = await worker.fetch(
      new Request("https://table-sparks.test/room/room-direct-link"),
      {
        ASSETS: {
          fetch: async (request: Request) => new Response(`asset:${new URL(request.url).pathname}`)
        }
      } as unknown as Env
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset:/room/room-direct-link");
  });

  it("creates private invite rooms with the requested game", async () => {
    const response = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "tic-tac-toe", boardVariant: "wide" }),
      headers: { "content-type": "application/json" }
    });

  expect(response.status).toBe(201);
  const json = (await response.json()) as {
    roomId: string;
    gameId: string;
    boardVariant: string;
    invitePath: string;
  };

    expect(json.gameId).toBe("tic-tac-toe");
    expect(json.boardVariant).toBe("wide");
    expect(json.roomId).toMatch(/^room-/);
    expect(json.invitePath).toBe(`/room/${json.roomId}`);
  });

  it("coordinates seats, moves, chat, reactions, and snapshots over WebSockets", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "four-in-a-row" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const red = await openRoomSocket(roomId);
    const yellow = await openRoomSocket(roomId);

    red.send(JSON.stringify({ type: "join", guestToken: "token-red", name: "Ruby" }));
    const redSnapshot = await waitForType(red, "room_snapshot");
    expect(redSnapshot.room?.players).toMatchObject([{ name: "Ruby", mark: "p1" }]);

    yellow.send(JSON.stringify({ type: "join", guestToken: "token-yellow", name: "Sunny" }));
    const yellowSnapshot = await waitForType(yellow, "room_snapshot");
    expect(yellowSnapshot.room?.players).toHaveLength(2);

    red.send(JSON.stringify({ type: "make_move", move: { column: 0 } }));
    const moveMessage = await waitForType(yellow, "move_applied");
    expect(moveMessage.move).toMatchObject({ player: "p1", row: 5, column: 0 });

    yellow.send(JSON.stringify({ type: "send_chat", body: "that drop was loud" }));
    const chatMessage = await waitForType(red, "chat_added");
    expect(chatMessage.chat?.body).toBe("that drop was loud");

    red.send(JSON.stringify({ type: "send_reaction", emoji: "😂" }));
    const reactionMessage = await waitForType(yellow, "reaction_added");
    expect(reactionMessage.reaction?.emoji).toBe("😂");

    const snapshotResponse = await SELF.fetch(`https://table-sparks.test/api/rooms/${roomId}`);
    const snapshot = (await snapshotResponse.json()) as ServerMessage["room"];
    expect(snapshot?.board[5][0]).toBe("p1");
    expect(snapshot?.chat.at(-1)?.body).toBe("that drop was loud");
  });

  it("keeps reconnect credentials out of every snapshot and prevents token replay from public ids", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "tic-tac-toe", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };
    const hostToken = "credential-host-secret";

    const host = await openRoomSocket(roomId);
    host.send(JSON.stringify({ type: "join", guestToken: hostToken, name: "Host" }));
    const hostSnapshot = await waitForType(host, "room_snapshot");
    expect(JSON.stringify(hostSnapshot)).not.toContain(hostToken);
    expect(hostSnapshot.room?.you?.mark).toBe("p1");

    const publicResponse = await SELF.fetch(`https://table-sparks.test/api/rooms/${roomId}`);
    const publicText = await publicResponse.text();
    expect(publicText).not.toContain(hostToken);
    const publicRoom = JSON.parse(publicText) as NonNullable<ServerMessage["room"]>;
    expect(publicRoom.you).toBeNull();
    const publicHostId = publicRoom.players.find((player) => player.mark === "p1")?.guestToken;
    expect(publicHostId).toBeTruthy();
    expect(publicHostId).not.toBe(hostToken);

    const attacker = await openRoomSocket(roomId);
    attacker.send(JSON.stringify({ type: "join", guestToken: publicHostId, name: "Attacker" }));
    const attackerSnapshot = await waitForType(attacker, "room_snapshot");
    expect(attackerSnapshot.room?.you?.mark).toBe("p2");
    expect(attackerSnapshot.room?.players.find((player) => player.mark === "p1")?.name).toBe("Host");
  });

  it("accepts only URL-safe guest credentials", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "tic-tac-toe", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };
    const socket = await openRoomSocket(roomId);

    socket.send(JSON.stringify({ type: "join", guestToken: "token with spaces", name: "Mallory" }));
    expect((await waitForType(socket, "error")).reason).toMatch(/invalid/i);

    socket.send(JSON.stringify({ type: "join", guestToken: "token-safe_123", name: "Ruby" }));
    const joined = await waitForType(socket, "room_snapshot");
    expect(joined.room?.you?.mark).toBe("p1");
    expect(joined.room?.players).toMatchObject([{ name: "Ruby", mark: "p1" }]);
  });

  it("rate-limits chat and reactions independently from gameplay messages", async () => {
    const { socket } = await createAndJoinRoom("tic-tac-toe", "rate-player", "Ruby");

    for (let index = 0; index < 8; index += 1) {
      socket.send(JSON.stringify({ type: "send_chat", body: `message ${index}` }));
      expect((await waitForType(socket, "chat_added")).chat?.body).toBe(`message ${index}`);
    }
    socket.send(JSON.stringify({ type: "send_chat", body: "one too many" }));
    expect((await waitForType(socket, "error")).reason).toMatch(/chat rate limit/i);

    for (let index = 0; index < 12; index += 1) {
      socket.send(JSON.stringify({ type: "send_reaction", emoji: "⭐" }));
      expect((await waitForType(socket, "reaction_added")).reaction?.emoji).toBe("⭐");
    }
    socket.send(JSON.stringify({ type: "send_reaction", emoji: "⭐" }));
    expect((await waitForType(socket, "error")).reason).toMatch(/reaction rate limit/i);
  });

  it("caps each socket at sixty total messages per ten-second window", async () => {
    const { socket } = await createAndJoinRoom("tic-tac-toe", "budget-player", "Ruby");

    // The join consumes the first message in this socket's aggregate budget.
    for (let index = 1; index < 60; index += 1) {
      socket.send(JSON.stringify({ type: "claim_seat" }));
      expect((await waitForType(socket, "error")).reason).toMatch(/only spectators/i);
    }

    socket.send(JSON.stringify({ type: "claim_seat" }));
    expect((await waitForType(socket, "error")).reason).toMatch(/too many messages/i);
  });

  it("deduplicates move commands and rejects stale revisions", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "tic-tac-toe", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };
    const x = await openRoomSocket(roomId);
    const o = await openRoomSocket(roomId);
    x.send(JSON.stringify({ type: "join", guestToken: "token-x", name: "Xena" }));
    const initial = await waitForType(x, "room_snapshot");
    o.send(JSON.stringify({ type: "join", guestToken: "token-o", name: "Omar" }));
    await waitForType(o, "room_snapshot");

    const command = {
      type: "make_move",
      move: { row: 0, column: 0 },
      commandId: "command-fixed-001",
      expectedRevision: initial.room?.revision ?? 0
    };
    x.send(JSON.stringify(command));
    const applied = await waitForType(x, "move_applied");
    expect(applied.room?.moveCount).toBe(1);
    expect(applied.room?.revision).toBe(1);

    x.send(JSON.stringify(command));
    const duplicate = await waitForType(x, "room_snapshot");
    expect(duplicate.room?.moveCount).toBe(1);

    o.send(JSON.stringify({
      type: "make_move",
      move: { row: 1, column: 1 },
      commandId: "command-stale-001",
      expectedRevision: 0
    }));
    const stale = await waitForType(o, "error");
    expect(stale.reason).toMatch(/table changed/i);
    const refreshed = await waitForType(o, "room_snapshot");
    expect(refreshed.room?.moveCount).toBe(1);
  });

  it("seats a bot opponent and answers after the human move", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        gameId: "tic-tac-toe",
        opponent: "bot",
        botDifficulty: "ruthless"
      }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const player = await openRoomSocket(roomId);
    player.send(JSON.stringify({ type: "join", guestToken: "token-human", name: "Ruby" }));
    const snapshot = await waitForType(player, "room_snapshot");
    expect(snapshot.room?.players).toMatchObject([
      { name: "Ruby", mark: "p1" },
      { name: "Spark Bot", mark: "p2", isBot: true }
    ]);

    player.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 0 } }));
    const humanMove = await waitForType(player, "move_applied");
    expect(humanMove.move?.player).toBe("p1");

    const botWaitStarted = performance.now();
    const botMove = await waitForType(player, "move_applied");
    expect(performance.now() - botWaitStarted).toBeGreaterThanOrEqual(300);
    expect(botMove.move?.player).toBe("p2");
    expect(botMove.room?.board.flat().filter(Boolean)).toHaveLength(2);
  });

  it("runs Word Hunt bot rooms as a timed word race after the human finds a word", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        gameId: "word-hunt",
        opponent: "bot",
        botDifficulty: "ruthless"
      }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const player = await openRoomSocket(roomId);
    player.send(JSON.stringify({ type: "join", guestToken: "token-human", name: "Ruby" }));
    const snapshot = await waitForType(player, "room_snapshot");
    const humanWord = snapshot.room?.meta?.wordHunt?.words[0];
    expect(humanWord).toBeTruthy();

    player.send(JSON.stringify({ type: "make_move", move: { column: 0, word: humanWord } }));
    const humanMove = await waitForType(player, "move_applied");
    expect(humanMove.move?.player).toBe("p1");
    expect(humanMove.room?.meta?.wordHunt?.found.p1).toContain(humanWord);

    const botMove = await waitForType(player, "move_applied");
    expect(botMove.move?.player).toBe("p2");
    expect(botMove.room?.meta?.wordHunt?.found.p2.length).toBeGreaterThan(0);
    expect(botMove.room?.meta?.wordHunt?.scores.p2).toBeGreaterThan(0);
  });

  it("starts Word Hunt bots racing after a seated player joins", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        gameId: "word-hunt",
        opponent: "bot",
        botDifficulty: "ruthless"
      }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const player = await openRoomSocket(roomId);
    player.send(JSON.stringify({ type: "join", guestToken: "token-human", name: "Ruby" }));
    const snapshot = await waitForType(player, "room_snapshot");
    expect(snapshot.room?.meta?.wordHunt?.found.p2).toHaveLength(0);

    const botMove = await waitForType(player, "move_applied");
    expect(botMove.move?.player).toBe("p2");
    expect(botMove.room?.meta?.wordHunt?.found.p2.length).toBe(1);
    expect(botMove.room?.meta?.wordHunt?.scores.p2).toBeGreaterThan(0);
  });

  it("keeps Word Hunt bots finding words during the timed round", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        gameId: "word-hunt",
        opponent: "bot",
        botDifficulty: "ruthless"
      }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const player = await openRoomSocket(roomId);
    player.send(JSON.stringify({ type: "join", guestToken: "token-human", name: "Ruby" }));
    await waitForType(player, "room_snapshot");

    const firstBotMove = await waitForType(player, "move_applied");
    const secondBotMove = await waitForType(player, "move_applied");

    expect(firstBotMove.move?.player).toBe("p2");
    expect(secondBotMove.move?.player).toBe("p2");
    expect(secondBotMove.room?.meta?.wordHunt?.found.p2.length).toBeGreaterThan(firstBotMove.room?.meta?.wordHunt?.found.p2.length ?? 0);
    expect(secondBotMove.room?.moveHistory.filter((move) => move.player === "p2")).toHaveLength(2);
  });

  it("fills Dominoes bot rooms with four seats", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        gameId: "dominoes",
        opponent: "bot"
      }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const player = await openRoomSocket(roomId);
    player.send(JSON.stringify({ type: "join", guestToken: "token-human", name: "Ruby" }));
    const snapshot = await waitForType(player, "room_snapshot");

    expect(snapshot.room?.players).toHaveLength(4);
    expect(snapshot.room?.players).toMatchObject([
      { name: "Ruby", mark: "p1" },
      { name: "Spark Bot", mark: "p2", isBot: true },
      { name: "Spark Bot 3", mark: "p3", isBot: true },
      { name: "Spark Bot 4", mark: "p4", isBot: true }
    ]);
    expect(snapshot.room?.meta?.dominoes?.handCounts).toEqual({ p1: 7, p2: 7, p3: 7, p4: 7 });
  });

  it("masks Dominoes opponent hands and hidden pip counts in room snapshots", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        gameId: "dominoes",
        opponent: "bot"
      }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const player = await openRoomSocket(roomId);
    player.send(JSON.stringify({ type: "join", guestToken: "token-human", name: "Ruby" }));
    const snapshot = await waitForType(player, "room_snapshot");
    const meta = snapshot.room?.meta?.dominoes;

    expect(meta?.hands.p1).toHaveLength(7);
    expect(meta?.hands.p2).toHaveLength(0);
    expect(meta?.hands.p3).toHaveLength(0);
    expect(meta?.hands.p4).toHaveLength(0);
    expect(meta?.handCounts).toEqual({ p1: 7, p2: 7, p3: 7, p4: 7 });
    expect(meta?.pipCounts?.p1).toBeGreaterThan(0);
    expect(meta?.pipCounts?.p2).toBe(0);
    expect(meta?.deck).toHaveLength(0);
    expect(meta?.teamScores).toEqual({ northSouth: 0, eastWest: 0 });
  });

  it("masks Color Clash opponent hands and draw-pile order in room snapshots", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        gameId: "last-card",
        opponent: "bot"
      }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const player = await openRoomSocket(roomId);
    player.send(JSON.stringify({ type: "join", guestToken: "token-human", name: "Ruby" }));
    const snapshot = await waitForType(player, "room_snapshot");
    const meta = snapshot.room?.meta?.lastCard;

    expect(snapshot.room?.gameId).toBe("last-card");
    expect(meta?.hands.p1).toHaveLength(7);
    expect(meta?.hands.p2).toHaveLength(0);
    expect(meta?.handCounts).toEqual({ p1: 7, p2: 7, p3: 0, p4: 0 });
    expect(meta?.deck).toHaveLength(0);
    expect(meta?.deckCount).toBeGreaterThan(70);
    expect(meta?.discard).toHaveLength(1);
  });

  it("masks hidden Sea Battle fleets in public and player snapshots", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        gameId: "battleship",
        opponent: "bot"
      }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const publicSnapshot = (await (await SELF.fetch(`https://table-sparks.test/api/rooms/${roomId}`)).json()) as ServerMessage["room"];
    expect(publicSnapshot?.meta?.battleship?.botFleet).toHaveLength(0);
    expect(publicSnapshot?.meta?.battleship?.playerFleet).toHaveLength(0);
    expect(publicSnapshot?.meta?.battleship?.botShips).toHaveLength(0);
    expect(publicSnapshot?.meta?.battleship?.playerShips).toHaveLength(0);

    const player = await openRoomSocket(roomId);
    player.send(JSON.stringify({ type: "join", guestToken: "token-human", name: "Ruby" }));
    const snapshot = await waitForType(player, "room_snapshot");
    const meta = snapshot.room?.meta?.battleship;

    expect(snapshot.room?.gameId).toBe("battleship");
    expect(meta?.botFleet).toHaveLength(0);
    expect(meta?.botShips).toHaveLength(0);
    expect(meta?.playerFleet).toHaveLength(5);
    expect(meta?.playerShips).toHaveLength(17);
  });

  it("creates Pipe Dash as a solo room without seating a bot opponent", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        gameId: "flappy-bird",
        opponent: "bot"
      }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const player = await openRoomSocket(roomId);
    player.send(JSON.stringify({ type: "join", guestToken: "token-human", name: "Ruby" }));
    const snapshot = await waitForType(player, "room_snapshot");

    expect(snapshot.room?.gameId).toBe("flappy-bird");
    expect(snapshot.room?.players).toMatchObject([
      { name: "Ruby", mark: "p1" }
    ]);
    expect(snapshot.room?.players.some((roomPlayer) => roomPlayer.isBot)).toBe(false);
  });

  it("resets rooms when a seated player changes board variants", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "tic-tac-toe", opponent: "bot" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const player = await openRoomSocket(roomId);
    player.send(JSON.stringify({ type: "join", guestToken: "token-human", name: "Ruby" }));
    await waitForType(player, "room_snapshot");

    player.send(JSON.stringify({ type: "set_board_variant", variant: "wide" }));
    const resized = await waitForType(player, "room_snapshot");

    expect(resized.room?.boardVariant).toBe("wide");
    expect(resized.room?.board).toHaveLength(5);
    expect(resized.room?.board[0]).toHaveLength(5);
  });

  it("lets only the host change room settings and allows host changes after moves", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "tic-tac-toe", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const host = await openRoomSocket(roomId);
    const guest = await openRoomSocket(roomId);
    host.send(JSON.stringify({ type: "join", guestToken: "token-host", name: "Hana" }));
    await waitForType(host, "room_snapshot");
    guest.send(JSON.stringify({ type: "join", guestToken: "token-guest", name: "Gus" }));
    await waitForType(guest, "room_snapshot");

    guest.send(JSON.stringify({ type: "set_board_variant", variant: "wide" }));
    const blockedGuest = await waitForType(guest, "error");
    expect(blockedGuest.reason).toBe("Only the host can change the board.");

    host.send(JSON.stringify({ type: "set_board_variant", variant: "wide" }));
    const resized = await waitForType(guest, "room_snapshot");
    expect(resized.room?.boardVariant).toBe("wide");

    host.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 0 } }));
    await waitForType(guest, "move_applied");
    host.send(JSON.stringify({ type: "set_board_variant", variant: "party" }));
    const resizedAfterMove = await waitForType(guest, "room_snapshot");
    expect(resizedAfterMove.room?.boardVariant).toBe("party");
    expect(resizedAfterMove.room?.board).toHaveLength(7);
    expect(resizedAfterMove.room?.board[0]).toHaveLength(7);
  });

  it("tracks move history and requires both friend players for undo", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "tic-tac-toe", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const x = await openRoomSocket(roomId);
    const o = await openRoomSocket(roomId);
    x.send(JSON.stringify({ type: "join", guestToken: "token-x", name: "Xena" }));
    await waitForType(x, "room_snapshot");
    o.send(JSON.stringify({ type: "join", guestToken: "token-o", name: "Omar" }));
    await waitForType(o, "room_snapshot");

    x.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 0 } }));
    const moved = await waitForType(o, "move_applied");
    expect(moved.room?.moveHistory).toMatchObject([{ player: "p1", label: "A1" }]);

    x.send(JSON.stringify({ type: "request_undo" }));
    const requested = await waitForType(o, "room_snapshot");
    expect(requested.room?.undoRequests).toHaveLength(1);
    expect(requested.room?.undoRequests).not.toContain("token-x");
    expect(requested.room?.board[0][0]).toBe("p1");

    o.send(JSON.stringify({ type: "request_undo" }));
    const undone = await waitForRoomWhere(x, (room) =>
      room.undoRequests.length === 0 && room.moveHistory.length === 0
    );
    expect(undone.room?.undoRequests).toEqual([]);
    expect(undone.room?.moveHistory).toHaveLength(0);
    expect(undone.room?.board[0][0]).toBe(null);
  });

  it("labels custom game move history with player-facing actions", async () => {
    const dartsRoom = await createAndJoinRoom("darts", "token-darts", "Darla");
    dartsRoom.socket.send(JSON.stringify({ type: "make_move", move: { row: 2, column: 0 } }));
    const dartsMove = await waitForType(dartsRoom.socket, "move_applied");
    expect(dartsMove.room?.moveHistory.at(-1)?.label).toBe("D20");

    const cupRoom = await createAndJoinRoom("cup-pong", "token-cup", "Cora");
    cupRoom.socket.send(JSON.stringify({ type: "make_move", move: { column: 0, power: 0.5, aim: 0 } }));
    const cupMove = await waitForType(cupRoom.socket, "move_applied");
    expect(cupMove.room?.moveHistory.at(-1)?.label).toBe("Cup 1");

    const morrisRoom = await createAndJoinRoom("nine-mens-morris", "token-morris", "Mira");
    morrisRoom.socket.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 0 } }));
    const morrisMove = await waitForType(morrisRoom.socket, "move_applied");
    expect(morrisMove.room?.moveHistory.at(-1)?.label).toBe("Point A1");
  });

  it("labels Nine Men's Morris mill captures as removals", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "nine-mens-morris", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };
    const white = await openRoomSocket(roomId);
    const black = await openRoomSocket(roomId);
    white.send(JSON.stringify({ type: "join", guestToken: "token-white", name: "Willa" }));
    await waitForType(white, "room_snapshot");
    black.send(JSON.stringify({ type: "join", guestToken: "token-black", name: "Basil" }));
    await waitForType(black, "room_snapshot");

    white.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 0 } }));
    await waitForType(white, "move_applied");
    black.send(JSON.stringify({ type: "make_move", move: { row: 1, column: 1 } }));
    await waitForType(white, "move_applied");
    white.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 3 } }));
    await waitForType(white, "move_applied");
    black.send(JSON.stringify({ type: "make_move", move: { row: 1, column: 3 } }));
    await waitForType(white, "move_applied");
    white.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 6 } }));
    const mill = await waitForType(white, "move_applied");
    expect(mill.room?.turn).toBe("p1");

    white.send(JSON.stringify({ type: "make_move", move: { row: 1, column: 1 } }));
    const removed = await waitForType(white, "move_applied");
    expect(removed.room?.moveHistory.at(-1)?.label).toBe("Remove B2");
    expect(removed.room?.turn).toBe("p2");
  });

  it("rejects an early rematch, then requires both friend votes after game over", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "tic-tac-toe", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const x = await openRoomSocket(roomId);
    const o = await openRoomSocket(roomId);
    x.send(JSON.stringify({ type: "join", guestToken: "token-x", name: "Xena" }));
    await waitForType(x, "room_snapshot");
    o.send(JSON.stringify({ type: "join", guestToken: "token-o", name: "Omar" }));
    await waitForType(o, "room_snapshot");

    x.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 0 } }));
    await waitForType(o, "move_applied");
    x.send(JSON.stringify({ type: "request_rematch" }));
    expect((await waitForType(x, "error")).reason).toMatch(/finish the current game/i);

    o.send(JSON.stringify({ type: "make_move", move: { row: 1, column: 0 } }));
    await waitForType(x, "move_applied");
    x.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 1 } }));
    await waitForType(o, "move_applied");
    o.send(JSON.stringify({ type: "make_move", move: { row: 1, column: 1 } }));
    await waitForType(x, "move_applied");
    x.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 2 } }));
    await waitForType(o, "game_over");

    x.send(JSON.stringify({ type: "request_rematch" }));
    const waiting = await waitForType(o, "room_snapshot");
    expect(waiting.room?.rematchRequests).toHaveLength(1);
    expect(waiting.room?.rematchRequests).not.toContain("token-x");
    expect(waiting.room?.board[0][0]).toBe("p1");

    o.send(JSON.stringify({ type: "request_rematch" }));
    const resetRoom = await waitForRoomWhere(x, (room) =>
      room.rematchRequests.length === 0 && room.board.flat().filter(Boolean).length === 0
    );
    expect(resetRoom.room?.rematchRequests).toEqual([]);
    expect(resetRoom.room?.board.flat().filter(Boolean)).toHaveLength(0);
  });

  it("protects a disconnected seat during the reconnect grace window", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "four-in-a-row", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const red = await openRoomSocket(roomId);
    const yellow = await openRoomSocket(roomId);
    const watcher = await openRoomSocket(roomId);
    red.send(JSON.stringify({ type: "join", guestToken: "token-red", name: "Ruby" }));
    await waitForType(red, "room_snapshot");
    yellow.send(JSON.stringify({ type: "join", guestToken: "token-yellow", name: "Sunny" }));
    await waitForType(yellow, "room_snapshot");
    watcher.send(JSON.stringify({ type: "join", guestToken: "token-watch", name: "Wally" }));
    const spectatorSnapshot = await waitForType(watcher, "room_snapshot");
    expect(spectatorSnapshot.room?.spectators).toMatchObject([{ name: "Wally" }]);

    yellow.close();
    await waitForRoomWhere(red, (room) =>
      room.players.some((player) => player.name === "Sunny" && player.connected === false)
    );
    watcher.send(JSON.stringify({ type: "claim_seat" }));
    const protectedSeat = await waitForType(watcher, "error");
    expect(protectedSeat.reason).toMatch(/protected/i);
    const snapshot = await SELF.fetch(`https://table-sparks.test/api/rooms/${roomId}`);
    const room = (await snapshot.json()) as NonNullable<ServerMessage["room"]>;
    expect(room.players.find((player) => player.mark === "p2")?.name).toBe("Sunny");
    expect(room.spectators).toMatchObject([{ name: "Wally" }]);
  });

  it("blocks spectator reactions until the game ends", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "tic-tac-toe", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };

    const x = await openRoomSocket(roomId);
    const o = await openRoomSocket(roomId);
    const watcher = await openRoomSocket(roomId);
    x.send(JSON.stringify({ type: "join", guestToken: "token-x", name: "Xena" }));
    await waitForType(x, "room_snapshot");
    o.send(JSON.stringify({ type: "join", guestToken: "token-o", name: "Omar" }));
    await waitForType(o, "room_snapshot");
    watcher.send(JSON.stringify({ type: "join", guestToken: "token-watch", name: "Wally" }));
    await waitForType(watcher, "room_snapshot");

    watcher.send(JSON.stringify({ type: "send_reaction", emoji: "🔥" }));
    const blocked = await waitForType(watcher, "error");
    expect(blocked.reason).toBe("Spectators can react after the game ends.");

    x.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 0 } }));
    await waitForType(o, "move_applied");
    o.send(JSON.stringify({ type: "make_move", move: { row: 1, column: 0 } }));
    await waitForType(x, "move_applied");
    x.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 1 } }));
    await waitForType(o, "move_applied");
    o.send(JSON.stringify({ type: "make_move", move: { row: 1, column: 1 } }));
    await waitForType(x, "move_applied");
    x.send(JSON.stringify({ type: "make_move", move: { row: 0, column: 2 } }));
    const gameOver = await waitForType(watcher, "game_over");
    expect(gameOver.winner).toBe("p1");

    watcher.send(JSON.stringify({ type: "send_reaction", emoji: "🏆" }));
    const reaction = await waitForType(x, "reaction_added");
    expect(reaction.reaction?.emoji).toBe("🏆");
  });

  it("runs a server-authoritative chess friend game for two WebSocket clients", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "chess", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };
    const white = await openRoomSocket(roomId);
    const black = await openRoomSocket(roomId);
    white.send(JSON.stringify({ type: "join", guestToken: "white-secret", name: "Willa" }));
    const initial = await waitForType(white, "room_snapshot");
    black.send(JSON.stringify({ type: "join", guestToken: "black-secret", name: "Basil" }));
    await waitForType(black, "room_snapshot");

    const whiteMoveForWhite = waitForType(white, "move_applied");
    const whiteMoveForBlack = waitForType(black, "move_applied");
    white.send(JSON.stringify({
      type: "make_move",
      commandId: "chess-command-0001",
      expectedRevision: initial.room?.revision ?? 0,
      move: { row: 6, column: 4, toRow: 4, toColumn: 4 }
    }));
    const [, whiteMove] = await Promise.all([whiteMoveForWhite, whiteMoveForBlack]);
    expect(whiteMove.room?.meta?.chess?.board[36]).toBe("P");
    expect(whiteMove.room?.turn).toBe("p2");
    expect(whiteMove.room?.meta?.chess?.turn).toBe("black");

    const blackMoveForWhite = waitForType(white, "move_applied");
    const blackMoveForBlack = waitForType(black, "move_applied");
    black.send(JSON.stringify({
      type: "make_move",
      commandId: "chess-command-0002",
      expectedRevision: whiteMove.room?.revision ?? 1,
      move: { row: 1, column: 4, toRow: 3, toColumn: 4 }
    }));
    const [blackMove] = await Promise.all([blackMoveForWhite, blackMoveForBlack]);
    expect(blackMove.room?.meta?.chess?.board[28]).toBe("p");
    expect(blackMove.room?.moveHistory.at(-1)?.label).toBe("E7-E5");
  });

  it("keeps friend rooms waiting until both seats are connected", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "chess", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };
    const host = await openRoomSocket(roomId);
    host.send(JSON.stringify({ type: "join", guestToken: "waiting-host", name: "Host" }));
    const waiting = await waitForType(host, "room_snapshot");
    expect(waiting.room?.phase).toBe("waiting");
    host.send(JSON.stringify({ type: "make_move", move: { row: 6, column: 4, toRow: 4, toColumn: 4 } }));
    expect((await waitForType(host, "error")).reason).toMatch(/waiting/i);

    const friend = await openRoomSocket(roomId);
    friend.send(JSON.stringify({ type: "join", guestToken: "waiting-friend", name: "Friend" }));
    const active = await waitForType(friend, "room_snapshot");
    expect(active.room?.phase).toBe("active");
    expect(active.room?.readyAt).toEqual(expect.any(Number));
  });

  it("resolves Set Trio friend claims atomically from stable public card ids", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "set-trio", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };
    const first = await openRoomSocket(roomId);
    const second = await openRoomSocket(roomId);
    first.send(JSON.stringify({ type: "join", guestToken: "finder-one", name: "Iris" }));
    const initial = await waitForType(first, "room_snapshot");
    second.send(JSON.stringify({ type: "join", guestToken: "finder-two", name: "Theo" }));
    await waitForType(second, "room_snapshot");
    const cards = initial.room?.meta?.setTrio?.board ?? [];
    const indices = findSetIndices(cards);
    const cardIds = indices.map((index) => cards[index].id);

    first.send(JSON.stringify({
      type: "make_move",
      commandId: "set-command-0001",
      expectedRevision: initial.room?.revision ?? 0,
      move: { column: indices[0], indices, cardIds }
    }));
    const applied = await waitForType(second, "move_applied");
    expect(applied.room?.meta?.setTrio?.scores.p1).toBe(1);
    expect(applied.room?.meta?.setTrio?.revision).toBe(1);
    expect(applied.room?.meta?.setTrio?.board.map((card) => card.id)).not.toEqual(cards.map((card) => card.id));

    second.send(JSON.stringify({
      type: "make_move",
      commandId: "set-command-stale",
      expectedRevision: 0,
      move: { column: indices[0], indices, cardIds }
    }));
    expect((await waitForType(second, "error")).reason).toMatch(/table changed/i);
  });

  it("enforces Set Trio invalid-claim cooldowns on the authoritative room", async () => {
    const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "set-trio", opponent: "friend" }),
      headers: { "content-type": "application/json" }
    });
    const { roomId } = (await created.json()) as { roomId: string };
    const first = await openRoomSocket(roomId);
    const second = await openRoomSocket(roomId);
    first.send(JSON.stringify({ type: "join", guestToken: "cooldown-one", name: "Iris" }));
    await waitForType(first, "room_snapshot");
    second.send(JSON.stringify({ type: "join", guestToken: "cooldown-two", name: "Theo" }));
    const active = await waitForType(second, "room_snapshot");
    const cards = active.room?.meta?.setTrio?.board ?? [];
    const indices = findNonSetIndices(cards);
    const cardIds = indices.map((index) => cards[index].id);

    first.send(JSON.stringify({
      type: "make_move",
      commandId: "set-invalid-0001",
      expectedRevision: active.room?.revision ?? 0,
      move: { column: indices[0], indices, cardIds }
    }));
    const applied = await waitForType(second, "move_applied");
    expect(applied.room?.meta?.setTrio?.scores.p1).toBe(-1);
    expect(applied.room?.meta?.setTrio?.cooldowns.p1?.expiresAt).toBeGreaterThan(Date.now());

    first.send(JSON.stringify({
      type: "make_move",
      commandId: "set-invalid-0002",
      expectedRevision: applied.room?.revision ?? 1,
      move: { column: indices[0], indices, cardIds }
    }));
    expect((await waitForType(first, "error")).reason).toMatch(/cooldown/i);
  });
});

function findSetIndices(cards: Array<{ number: number; color: number; shape: number; fill: number }>): [number, number, number] {
  for (let first = 0; first < cards.length - 2; first += 1) {
    for (let second = first + 1; second < cards.length - 1; second += 1) {
      for (let third = second + 1; third < cards.length; third += 1) {
        const trio = [cards[first], cards[second], cards[third]];
        const valid = (["number", "color", "shape", "fill"] as const).every(
          (feature) => trio.reduce((sum, card) => sum + card[feature], 0) % 3 === 0
        );
        if (valid) return [first, second, third];
      }
    }
  }
  throw new Error("Expected a playable Set Trio table.");
}

function findNonSetIndices(cards: Array<{ number: number; color: number; shape: number; fill: number }>): [number, number, number] {
  for (let first = 0; first < cards.length - 2; first += 1) {
    for (let second = first + 1; second < cards.length - 1; second += 1) {
      for (let third = second + 1; third < cards.length; third += 1) {
        const trio = [cards[first], cards[second], cards[third]];
        const valid = (["number", "color", "shape", "fill"] as const).every(
          (feature) => trio.reduce((sum, card) => sum + card[feature], 0) % 3 === 0
        );
        if (!valid) return [first, second, third];
      }
    }
  }
  throw new Error("Expected at least one invalid Set Trio claim.");
}

async function createAndJoinRoom(
  gameId: string,
  guestToken: string,
  name: string
): Promise<{ roomId: string; socket: WebSocket }> {
  const created = await SELF.fetch("https://table-sparks.test/api/rooms", {
    method: "POST",
    body: JSON.stringify({ gameId, opponent: "bot" }),
    headers: { "content-type": "application/json" }
  });
  const { roomId } = (await created.json()) as { roomId: string };
  const socket = await openRoomSocket(roomId);
  socket.send(JSON.stringify({ type: "join", guestToken, name }));
  await waitForType(socket, "room_snapshot");
  return { roomId, socket };
}

async function openRoomSocket(roomId: string): Promise<WebSocket> {
  const response = await SELF.fetch(`https://table-sparks.test/api/rooms/${roomId}/socket`, {
    headers: { upgrade: "websocket" }
  });

  expect(response.status).toBe(101);
  expect(response.webSocket).toBeTruthy();

  const socket = response.webSocket;
  if (!socket) throw new Error("Expected WebSocket response.");
  socket.accept();
  openSockets.add(socket);
  socket.addEventListener("close", () => openSockets.delete(socket), { once: true });
  return socket;
}

function waitForRoomWhere(
  socket: WebSocket,
  predicate: (room: NonNullable<ServerMessage["room"]>) => boolean
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for matching room")), 2500);

    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (!message.room || !predicate(message.room)) return;

      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      resolve(message);
    };

    socket.addEventListener("message", onMessage);
  });
}

function waitForType(socket: WebSocket, type: string): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 2500);

    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (message.type !== type) {
        return;
      }

      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      resolve(message);
    };

    socket.addEventListener("message", onMessage);
  });
}
