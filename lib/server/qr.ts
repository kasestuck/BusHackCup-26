import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ECONOMY } from "./economy.ts";

/** Hash both strings to equal-length buffers before constant-time comparison. */
export function safeEqualText(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left, "utf8").digest();
  const rightHash = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftHash, rightHash);
}

function unixSecondsAt(now: Date): number {
  const milliseconds = now.getTime();
  if (!Number.isFinite(milliseconds)) throw new RangeError("Invalid QR token timestamp.");
  return Math.floor(milliseconds / 1000);
}

function tokenForWindow(secret: string, window: number): string {
  if (secret.length === 0) throw new Error("The gym QR secret is empty.");
  return createHmac("sha256", secret).update(String(window), "utf8").digest("hex");
}

export function createGymQrToken(secret: string, now = new Date()): {
  token: string;
  expires_in: number;
} {
  const seconds = unixSecondsAt(now);
  const window = Math.floor(seconds / ECONOMY.qrWindowSeconds);
  return {
    token: tokenForWindow(secret, window),
    expires_in: (window + 1) * ECONOMY.qrWindowSeconds - seconds,
  };
}

/** Compare both accepted windows even when the first comparison succeeds. */
export function verifyGymQrToken(secret: string, token: string, now = new Date()): boolean {
  const window = Math.floor(unixSecondsAt(now) / ECONOMY.qrWindowSeconds);
  const matchesCurrent = safeEqualText(tokenForWindow(secret, window), token);
  const matchesPrevious = safeEqualText(tokenForWindow(secret, window - 1), token);
  return /^[0-9a-f]{64}$/.test(token) && (matchesCurrent || matchesPrevious);
}
