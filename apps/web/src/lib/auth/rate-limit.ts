/**
 * Rate-limiting en mémoire des tentatives d'authentification (anti brute-force).
 *
 * Fenêtre glissante par clé (IP, IP+email…). Stockage dans le process Node :
 * suffisant en single-instance ; à remplacer par Redis/upstash si l'app est
 * déployée multi-instances (chaque instance a alors son propre compteur).
 */

const WINDOW_MS = 15 * 60 * 1000;

interface Entry {
  count: number;
  windowStart: number;
}

const attempts = new Map<string, Entry>();

// Borne la mémoire : purge opportuniste des fenêtres expirées
function prune(now: number) {
  if (attempts.size < 10_000) return;
  for (const [key, entry] of attempts) {
    if (now - entry.windowStart > WINDOW_MS) attempts.delete(key);
  }
}

/** True si la clé a dépassé `max` échecs dans la fenêtre courante. */
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
