import { createHash } from "node:crypto";
import { ECONOMY } from "./economy.ts";

type Counter = { windowStart: number; windowMs: number; count: number };

/** Keep raw client addresses and credentials out of the process-local map. */
export function hashRateLimitKey(scope: string, value: string): string {
  return `${scope}:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

/** Demo limiter: counters are neither shared across processes nor persisted. */
export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, Counter>();
  private readonly maxEntries: number;

  constructor(maxEntries: number = ECONOMY.rateLimits.maxEntries) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new RangeError("Invalid rate limiter capacity.");
    this.maxEntries = maxEntries;
  }

  consume(key: string, limit: number, windowSeconds: number, nowMs = Date.now()): boolean {
    if (!Number.isSafeInteger(limit) || limit < 1
      || !Number.isSafeInteger(windowSeconds) || windowSeconds < 1
      || !Number.isSafeInteger(windowSeconds * 1000) || !Number.isFinite(nowMs)) {
      throw new RangeError("Invalid rate limit configuration or timestamp.");
    }
    const windowMs = windowSeconds * 1000;
    const windowStart = Math.floor(nowMs / windowMs) * windowMs;
    let counter = this.entries.get(key);
    if (counter && (counter.windowStart !== windowStart || counter.windowMs !== windowMs)) {
      this.entries.delete(key);
      counter = undefined;
    }

    if (!counter) {
      if (this.entries.size >= this.maxEntries) {
        for (const [storedKey, stored] of this.entries) {
          if (nowMs >= stored.windowStart + stored.windowMs) this.entries.delete(storedKey);
        }
        // Fail closed instead of evicting an active counter and allowing a bypass.
        if (this.entries.size >= this.maxEntries) return false;
      }
      counter = { windowStart, windowMs, count: 0 };
      this.entries.set(key, counter);
    }
    if (counter.count >= limit) return false;
    counter.count += 1;
    return true;
  }
}

export const rateLimiter = new FixedWindowRateLimiter();
