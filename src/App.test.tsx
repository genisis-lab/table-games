import { describe, expect, it } from "vitest";
import { resolveApiOrigin, syncArcadeDebugFlagFromUrl } from "./App";

describe("resolveApiOrigin", () => {
  it("uses the deployed Worker API when the app is served from Cloudflare Pages", () => {
    expect(resolveApiOrigin("table-sparks-game.pages.dev")).toBe("https://table-sparks.neil27.workers.dev");
  });

  it("keeps local and explicit API origins unchanged", () => {
    expect(resolveApiOrigin("localhost")).toBe("");
    expect(resolveApiOrigin("table-sparks-game.pages.dev", "https://api.example.test/")).toBe("https://api.example.test");
  });
});

describe("syncArcadeDebugFlagFromUrl", () => {
  it("persists arcade debug mode across room redirects", () => {
    localStorage.removeItem("table-sparks-arcade-debug");
    window.history.pushState({}, "", "/new/flappy-bird?arcadeDebug=1");

    syncArcadeDebugFlagFromUrl();

    expect(localStorage.getItem("table-sparks-arcade-debug")).toBe("1");
    window.history.pushState({}, "", "/");
  });

  it("allows arcade debug mode to be turned off from the URL", () => {
    localStorage.setItem("table-sparks-arcade-debug", "1");
    window.history.pushState({}, "", "/room/room-test?arcadeDebug=0");

    syncArcadeDebugFlagFromUrl();

    expect(localStorage.getItem("table-sparks-arcade-debug")).toBeNull();
    window.history.pushState({}, "", "/");
  });
});
