import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PayloadTooLargeError, readJsonBody } from "../worker/request-body";

describe("security disclosure", () => {
  it("publishes a canonical text/plain security.txt outside the SPA fallback", () => {
    const policy = readFileSync("public/.well-known/security.txt", "utf8");
    const headers = readFileSync("public/_headers", "utf8");

    expect(policy).toContain("Contact: https://github.com/genisis-lab/table-games/security/advisories/new");
    expect(policy).toContain("Expires: 2027-08-13T00:00:00Z");
    expect(policy).toContain("Canonical: https://table.builtwai.com/.well-known/security.txt");
    expect(headers).toContain("/.well-known/security.txt");
    expect(headers).toContain("Content-Type: text/plain; charset=utf-8");
    expect(headers).toContain("Content-Security-Policy:");
    expect(headers).toContain("style-src-attr 'unsafe-inline'");
    expect(headers).toContain("Strict-Transport-Security:");
  });

  it("bounds JSON streams even when content length is unavailable", async () => {
    const request = new Request("https://table.test/api/rooms", {
      method: "POST",
      body: JSON.stringify({ padding: "x".repeat(128) }),
      headers: { "content-type": "application/json" }
    });
    request.headers.delete("content-length");

    await expect(readJsonBody(request, 64)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("distinguishes malformed bounded JSON from oversized input", async () => {
    const malformed = new Request("https://table.test/api/rooms", {
      method: "POST",
      body: "{not-json"
    });

    await expect(readJsonBody(malformed, 64)).rejects.toBeInstanceOf(SyntaxError);
  });
});
