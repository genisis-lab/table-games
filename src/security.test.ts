import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
});
