import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { createGymQrToken, safeEqualText, verifyGymQrToken } from "./qr.ts";

const secret = "test-only-gym-secret";

test("QR tokens use the specified minute HMAC and a positive remaining lifetime", () => {
  const now = new Date("2026-11-14T12:34:00.000Z");
  const expected = createHmac("sha256", secret)
    .update(String(Math.floor(now.getTime() / 60_000))).digest("hex");
  assert.deepEqual(createGymQrToken(secret, now), { token: expected, expires_in: 60 });
  assert.equal(createGymQrToken(secret, new Date("2026-11-14T12:34:59.999Z")).expires_in, 1);
  assert.equal(createGymQrToken(secret, new Date("2026-11-14T12:35:00.000Z")).expires_in, 60);
});

test("the previous window remains valid across the exact minute boundary", () => {
  const token = createGymQrToken(secret, new Date("2026-11-14T12:34:59.999Z")).token;
  assert.equal(verifyGymQrToken(secret, token, new Date("2026-11-14T12:34:59.999Z")), true);
  assert.equal(verifyGymQrToken(secret, token, new Date("2026-11-14T12:35:00.000Z")), true);
  assert.equal(verifyGymQrToken(secret, token, new Date("2026-11-14T12:35:59.999Z")), true);
  assert.equal(verifyGymQrToken(secret, token, new Date("2026-11-14T12:36:00.000Z")), false);
});

test("a three-minute-old token, a future token and another gym's token are rejected", () => {
  const now = new Date("2026-11-14T12:37:20.000Z");
  const old = createGymQrToken(secret, new Date("2026-11-14T12:34:20.000Z")).token;
  const future = createGymQrToken(secret, new Date("2026-11-14T12:38:00.000Z")).token;
  const otherGym = createGymQrToken("another-test-secret", now).token;
  for (const token of [old, future, otherGym, "", "a", "0".repeat(65), "not-hex".repeat(10)]) {
    assert.equal(verifyGymQrToken(secret, token, now), false);
  }
});

test("different-length key comparisons are safe and do not accept a prefix", () => {
  assert.equal(safeEqualText("shared-secret", "shared-secret"), true);
  assert.equal(safeEqualText("shared-secret", "shared"), false);
  assert.equal(safeEqualText("shared-secret", "shared-secret-extra"), false);
  assert.equal(safeEqualText("", "shared-secret"), false);
  assert.equal(safeEqualText("secret", "SECRET"), false);
});

test("invalid timestamps and empty server secrets fail explicitly", () => {
  assert.throws(() => createGymQrToken(secret, new Date(Number.NaN)), /timestamp/);
  assert.throws(() => verifyGymQrToken(secret, "0".repeat(64), new Date(Number.NaN)), /timestamp/);
  assert.throws(() => createGymQrToken(""), /secret/);
});
