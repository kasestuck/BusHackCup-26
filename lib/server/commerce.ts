import "server-only";

import { randomBytes } from "node:crypto";
import { ECONOMY } from "./economy.ts";
import { HttpError } from "./http.ts";

const PROMO_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Rejection sampling avoids modulo bias and ambiguous characters. */
export function generatePromoCode(): string {
  let suffix = "";
  const ceiling = Math.floor(256 / PROMO_ALPHABET.length) * PROMO_ALPHABET.length;
  while (suffix.length < 6) {
    for (const byte of randomBytes(12)) {
      if (byte >= ceiling) continue;
      suffix += PROMO_ALPHABET[byte % PROMO_ALPHABET.length];
      if (suffix.length === 6) break;
    }
  }
  return `SHOWUP-${suffix}`;
}

/** Candidate collisions are retried by the database inside the same transaction. */
export function generatePromoCandidates(): string[] {
  return Array.from({ length: ECONOMY.promoCollisionAttempts }, generatePromoCode);
}

export function throwCommerceError(error: { code?: string; message?: string; details?: string | null }): never {
  if (error.code === "P0001") {
    switch (error.message) {
      case "reward_not_found": throw new HttpError(404, "reward_not_found");
      case "reward_inactive": throw new HttpError(409, "reward_inactive");
      case "redemption_not_found": throw new HttpError(404, "redemption_not_found");
      case "already_purchased": throw new HttpError(409, "already_purchased");
      case "partner_not_found": throw new HttpError(404, "partner_not_found");
      case "validation_error": throw new HttpError(422, "validation_error");
      case "not_enough_coins": {
        const shortage = typeof error.details === "string" && /^[1-9][0-9]*$/.test(error.details)
          ? Number(error.details) : Number.NaN;
        if (Number.isSafeInteger(shortage) && shortage > 0) {
          throw new HttpError(402, "not_enough_coins", `You need ${shortage} more coins.`);
        }
        break;
      }
    }
  }
  throw error;
}
