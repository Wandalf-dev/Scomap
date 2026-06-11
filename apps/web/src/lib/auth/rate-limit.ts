/**
 * In-memory rate-limiting of authentication attempts (anti brute-force).
 *
 * Sliding window per key (IP, IP+email…). Stored in the Node process:
 * sufficient for a single instance; replace with Redis/upstash if the app is
 * deployed across multiple instances (each instance would then have its own counter).
 */

const WINDOW_MS = 15 * 60 * 1000;

interface Entry {
  count: number;
  windowStart: number;
}

const attempts = new Map<string, Entry>();

// Cap memory usage: opportunistic purge of expired windows
function prune(now: number) {
  if (attempts.size < 10_000) return;
  for (const [key, entry] of attempts) {
    if (now - entry.windowStart > WINDOW_MS) attempts.delete(key);
  }
}

/** True if the key has exceeded `max` failures in the current window. */
export function isRateLimited(key: string, max: number): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= max;
}

export function recordFailure(key: string): void {
  const now = Date.now();
  prune(now);
  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
