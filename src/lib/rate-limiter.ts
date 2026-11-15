/**
 * In-memory sliding window rate limiter for brute-force attack prevention.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Seconds until reset
}

export function checkRateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes default
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || record.resetAt <= now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil(windowMs / 1000)
    };
  }

  if (record.count >= limit) {
    const secondsRemaining = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      reset: secondsRemaining
    };
  }

  record.count += 1;
  const secondsRemaining = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    reset: secondsRemaining
  };
}

export function resetRateLimit(identifier: string) {
  rateLimitStore.delete(identifier);
}
