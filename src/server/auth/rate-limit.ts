// Basic in-memory login rate limit — fine for this app's scale (2 Admin,
// ~8 employees, single Node process per deployment). Not shared across
// serverless instances; that's an accepted trade-off for an internal tool.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = { count: number; windowStartedAt: number };
const buckets = new Map<string, Bucket>();

function currentBucket(key: string): Bucket | null {
  const bucket = buckets.get(key);
  if (!bucket) return null;
  if (Date.now() - bucket.windowStartedAt > WINDOW_MS) {
    buckets.delete(key);
    return null;
  }
  return bucket;
}

export function isRateLimited(key: string): boolean {
  const bucket = currentBucket(key);
  return bucket !== null && bucket.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(key: string): void {
  const bucket = currentBucket(key);
  if (bucket) {
    bucket.count += 1;
  } else {
    buckets.set(key, { count: 1, windowStartedAt: Date.now() });
  }
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
