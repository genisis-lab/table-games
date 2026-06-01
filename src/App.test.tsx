import { describe, expect, it } from "vitest";
import { resolveApiOrigin } from "./App";

describe("resolveApiOrigin", () => {
  it("uses the deployed Worker API when the app is served from Cloudflare Pages", () => {
    expect(resolveApiOrigin("table-sparks-game.pages.dev")).toBe("https://table-sparks.neil27.workers.dev");
  });

  it("keeps local and explicit API origins unchanged", () => {
    expect(resolveApiOrigin("localhost")).toBe("");
    expect(resolveApiOrigin("table-sparks-game.pages.dev", "https://api.example.test/")).toBe("https://api.example.test");
  });
});
