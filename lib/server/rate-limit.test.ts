import assert from "node:assert/strict";
import { test } from "node:test";
import { FixedWindowRateLimiter, hashRateLimitKey } from "./rate-limit.ts";

test("rate limits count independently by key and reset at a window boundary", () => {
  const limiter = new FixedWindowRateLimiter();
  assert.equal(limiter.consume("user-a", 2, 60, 0), true);
  assert.equal(limiter.consume("user-a", 2, 60, 59_999), true);
  assert.equal(limiter.consume("user-a", 2, 60, 59_999), false);
  assert.equal(limiter.consume("user-b", 2, 60, 59_999), true);
  assert.equal(limiter.consume("user-a", 2, 60, 60_000), true);
});

test("a full limiter fails closed and reclaims expired entries", () => {
  const limiter = new FixedWindowRateLimiter(1);
  assert.equal(limiter.consume("first", 1, 60, 0), true);
  assert.equal(limiter.consume("new", 1, 60, 0), false);
  assert.equal(limiter.consume("first", 1, 60, 0), false);
  assert.equal(limiter.consume("new", 1, 60, 60_000), true);
});

test("rate-limit keys contain only a scope and a hash of the sensitive value", () => {
  const key = hashRateLimitKey("qr-key", "test-only-credential");
  assert.match(key, /^qr-key:[0-9a-f]{64}$/);
  assert.equal(key.includes("test-only-credential"), false);
  assert.notEqual(key, hashRateLimitKey("qr-ip", "test-only-credential"));
});
