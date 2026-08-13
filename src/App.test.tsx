import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, copyText, createRoomOptionsFromSearch, reconnectDelayForAttempt, resolveApiOrigin } from "./App";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => {
      storage.delete(key);
    },
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    }
  });
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("resolveApiOrigin", () => {
  it("uses the deployed Worker API when the app is served from Cloudflare Pages", () => {
    expect(resolveApiOrigin("table-sparks-game.pages.dev")).toBe("https://table-sparks.neil27.workers.dev");
    expect(resolveApiOrigin("table.builtwai.com")).toBe("");
  });

  it("keeps local and explicit API origins unchanged", () => {
    expect(resolveApiOrigin("localhost")).toBe("");
    expect(resolveApiOrigin("table-sparks-game.pages.dev", "https://api.example.test/")).toBe("https://api.example.test");
  });
});

describe("createRoomOptionsFromSearch", () => {
  it("honors direct /new route bot room query options", () => {
    expect(createRoomOptionsFromSearch("word-hunt", "?opponent=bot&botDifficulty=sharp&boardVariant=wide")).toEqual({
      opponent: "bot",
      botDifficulty: "sharp",
      boardVariant: "wide",
      botStarts: false
    });
  });

  it("supports compact direct-link aliases and validates unavailable options", () => {
    expect(createRoomOptionsFromSearch("four-in-a-row", "?opponent=bot&difficulty=casual&variant=wide&botStarts=1")).toEqual({
      opponent: "bot",
      botDifficulty: "casual",
      boardVariant: undefined,
      botStarts: true
    });
  });
});

describe("reconnectDelayForAttempt", () => {
  it("backs off reconnect attempts without requiring a manual refresh", () => {
    expect(reconnectDelayForAttempt(0)).toBe(350);
    expect(reconnectDelayForAttempt(1)).toBe(700);
    expect(reconnectDelayForAttempt(8)).toBe(4000);
  });
});

describe("room connection recovery", () => {
  it("shows retry and lobby actions when a room socket closes before its first snapshot", async () => {
    class FailedWebSocket extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      readonly readyState = 3;

      constructor(_url: string) {
        super();
        window.setTimeout(() => this.dispatchEvent(new Event("close")), 0);
      }

      send() {}
      close() {}
    }

    storage.set("table-sparks-guest-name", "Tester");
    vi.stubGlobal("WebSocket", FailedWebSocket);
    window.history.replaceState({}, "", "/room/missing-room");
    render(<App />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/unavailable|no longer valid/i));
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to games" })).toHaveAttribute("href", "/");
  });

  it("propagates clipboard permission failures so the room can show recovery feedback", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText("https://table.test/room/abc")).rejects.toThrow("denied");
    expect(writeText).toHaveBeenCalledWith("https://table.test/room/abc");
  });
});
