import { SELF, reset } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";

type ServerMessage = {
  type: string;
  room?: {
    roomId: string;
    gameId: string;
    boardVariant?: string;
    board: Array<Array<string | null>>;
    players: Array<{ name: string; mark: string; guestToken?: string }>;
    spectators: Array<{ name: string; guestToken?: string }>;
    chat: Array<{ body: string }>;
    moveHistory: Array<{ player: string; label: string }>;
    rematchRequests: string[];
    undoRequests: string[];
  };
  move?: { player: string; row: number; column: number };
  chat?: { body: string };
  reaction?: { emoji: string };
};

afterEach(async () => {
  await reset();
});

describe("GameRoom Durable Object", () => {
  it("creates private invite rooms with the requested game", async () => {
    const response = await SELF.fetch("https://table-sparks.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: "gomoku" }),
      headers: { "content-type": "application/json" }
    });

  expect(response.status).toBe(201);
  const json = (await response.json()) as {
    roomId: string;
    gameId: string;
    invitePath: string;
  };

    expect(json.gameId).toBe("gomoku");
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

    const botMove = await waitForType(player, "move_applied");
    expect(botMove.move?.player).toBe("p2");
    expect(botMove.room?.board.flat().filter(Boolean)).toHaveLength(2);
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
    expect(requested.room?.undoRequests).toEqual(["token-x"]);
    expect(requested.room?.board[0][0]).toBe("p1");

    o.send(JSON.stringify({ type: "request_undo" }));
    const undone = await waitForRoomWhere(x, (room) =>
      room.undoRequests.length === 0 && room.moveHistory.length === 0
    );
    expect(undone.room?.undoRequests).toEqual([]);
    expect(undone.room?.moveHistory).toHaveLength(0);
    expect(undone.room?.board[0][0]).toBe(null);
  });

  it("votes for rematches in friend rooms before resetting", async () => {
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
    const waiting = await waitForType(o, "room_snapshot");
    expect(waiting.room?.rematchRequests).toEqual(["token-x"]);
    expect(waiting.room?.board[0][0]).toBe("p1");

    o.send(JSON.stringify({ type: "request_rematch" }));
    const resetRoom = await waitForRoomWhere(x, (room) =>
      room.rematchRequests.length === 0 && room.board.flat().filter(Boolean).length === 0
    );
    expect(resetRoom.room?.rematchRequests).toEqual([]);
    expect(resetRoom.room?.board.flat().filter(Boolean)).toHaveLength(0);
  });

  it("lets a spectator claim an open seat", async () => {
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
    await waitForType(red, "presence_changed");
    watcher.send(JSON.stringify({ type: "claim_seat" }));
    const claimed = await waitForRoomWhere(red, (room) =>
      room.players.some((player) => player.name === "Wally" && player.mark === "p2")
    );
    expect(claimed.room?.players).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Wally", mark: "p2" })])
    );
    expect(claimed.room?.spectators).toHaveLength(0);
  });
});

async function openRoomSocket(roomId: string): Promise<WebSocket> {
  const response = await SELF.fetch(`https://table-sparks.test/api/rooms/${roomId}/socket`, {
    headers: { upgrade: "websocket" }
  });

  expect(response.status).toBe(101);
  expect(response.webSocket).toBeTruthy();

  const socket = response.webSocket;
  if (!socket) throw new Error("Expected WebSocket response.");
  socket.accept();
  return socket;
}

function waitForRoomWhere(
  socket: WebSocket,
  predicate: (room: NonNullable<ServerMessage["room"]>) => boolean
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for matching room")), 1000);

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
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 1000);

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
