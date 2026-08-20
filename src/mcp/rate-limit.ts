// In-memory sliding-window request limiter for the MCP route (plan.md Phase
// 15 point 5) — same "internal tool, single Node process per deployment,
// not shared across serverless instances" trade-off already accepted for
// login in `server/auth/rate-limit.ts`. Keyed by `client:<mcpClientId>` once
// authenticated (throttles a runaway/misbehaving AI agent), or by
// `ip:<address>` for pre-auth requests (guards the hash lookup itself
// against brute-force/DoS, independent of any one client).
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

type Bucket = { count: number; windowStartedAt: number };
const buckets = new Map<string, Bucket>();

export function isMcpRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStartedAt > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}
