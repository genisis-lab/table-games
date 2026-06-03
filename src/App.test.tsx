import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconnectDelayForAttempt, resolveApiOrigin } from "./App";

beforeEach(() => {
  const storage = new Map<string, string>();
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
  vi.unstubAllGlobals();
});

describe("resolveApiOrigin", () => {
  it("uses the deployed Worker API when the app is served from Cloudflare Pages", () => {
    expect(resolveApiOrigin("table-sparks-game.pages.dev")).toBe("https://table-sparks.neil27.workers.dev");
  });

  it("keeps local and explicit API origins unchanged", () => {
    expect(resolveApiOrigin("localhost")).toBe("");
    expect(resolveApiOrigin("table-sparks-game.pages.dev", "https://api.example.test/")).toBe("https://api.example.test");
  });
});

describe("reconnectDelayForAttempt", () => {
  it("backs off reconnect attempts without requiring a manual refresh", () => {
    expect(reconnectDelayForAttempt(0)).toBe(350);
    expect(reconnectDelayForAttempt(1)).toBe(700);
    expect(reconnectDelayForAttempt(8)).toBe(4000);
  });
});
