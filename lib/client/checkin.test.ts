import { test } from "node:test";
import assert from "node:assert/strict";
import { checkinUrl, formatCountdown, normalizeCode, parseCheckinInput, streakLabel } from "./checkin.ts";

const origin = "https://showup.example";

test("checkinUrl encodes gym and token as query params", () => {
  assert.equal(checkinUrl(origin, "gym 1", "123456"), "https://showup.example/checkin?gym=gym+1&token=123456");
});

test("normalizeCode strips spaces and dashes", () => {
  assert.equal(normalizeCode(" 123-456 "), "123456");
  assert.equal(normalizeCode("12 34 56"), "123456");
});

test("parseCheckinInput reads our own check-in links", () => {
  assert.deepEqual(parseCheckinInput(checkinUrl(origin, "g1", "654321"), origin), { gymId: "g1", token: "654321" });
});

test("parseCheckinInput treats foreign links and plain text as a code", () => {
  assert.deepEqual(parseCheckinInput("https://evil.example/checkin?gym=g1&token=1", origin), {
    gymId: null,
    token: "https://evil.example/checkin?gym=g1&token=1",
  });
  assert.deepEqual(parseCheckinInput("123 456", origin), { gymId: null, token: "123456" });
});

test("labels", () => {
  assert.equal(streakLabel(1), "1 day");
  assert.equal(streakLabel(7), "7 days");
  assert.equal(formatCountdown(42.2), "0:43");
  assert.equal(formatCountdown(60), "1:00");
});
