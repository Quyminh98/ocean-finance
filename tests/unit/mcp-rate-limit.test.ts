import { describe, expect, it } from "vitest";
import { isMcpRateLimited } from "@/mcp/rate-limit";

describe("isMcpRateLimited (plan.md Phase 15 point 5)", () => {
  it("allows the first 60 requests in a window and rejects the 61st", () => {
    const key = `test-key-${Math.random()}`;
    for (let i = 0; i < 60; i++) {
      expect(isMcpRateLimited(key)).toBe(false);
    }
    expect(isMcpRateLimited(key)).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    const keyA = `test-key-a-${Math.random()}`;
    const keyB = `test-key-b-${Math.random()}`;
    for (let i = 0; i < 60; i++) isMcpRateLimited(keyA);
    expect(isMcpRateLimited(keyA)).toBe(true);
    expect(isMcpRateLimited(keyB)).toBe(false);
  });
});
