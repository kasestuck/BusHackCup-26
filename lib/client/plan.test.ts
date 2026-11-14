import { test } from "node:test";
import assert from "node:assert/strict";
import type { Plan } from "@/lib/contract";
import {
  formatRest,
  isPlaceholderVideo,
  resolveDayIndex,
  weekTotals,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from "./plan.ts";

const ex = (sets: number) => ({
  slug: `e${sets}`,
  name: "E",
  sets,
  reps: "8",
  rest_sec: 60,
  note: "",
  video: { youtube_id: "abc", title: "t" },
});

const plan: Plan = {
  id: "p",
  title: "T",
  summary: "",
  days: [
    { weekday: 1, focus: "A", duration_min: 45, exercises: [ex(3), ex(4)] },
    { weekday: 3, focus: "B", duration_min: 30, exercises: [ex(2)] },
    { weekday: 5, focus: "C", duration_min: 60, exercises: [] },
  ],
  safety_note: "",
};

const wednesday = new Date(2026, 10, 11);
const saturday = new Date(2026, 10, 14);

test("resolveDayIndex prefers a valid ?day=, then today, then next", () => {
  assert.equal(resolveDayIndex(plan, wednesday, "2"), 2);
  assert.equal(resolveDayIndex(plan, wednesday, "9"), 1);
  assert.equal(resolveDayIndex(plan, wednesday, "-1"), 1);
  assert.equal(resolveDayIndex(plan, wednesday, null), 1);
  assert.equal(resolveDayIndex(plan, saturday, null), 0);
  assert.equal(resolveDayIndex({ ...plan, days: [] }, saturday, null), -1);
});

test("weekTotals sums sessions, minutes, exercises and sets", () => {
  assert.deepEqual(weekTotals(plan), { sessions: 3, minutes: 135, exercises: 3, sets: 9 });
});

test("formatRest renders m:ss", () => {
  assert.equal(formatRest(90), "1:30");
  assert.equal(formatRest(45), "0:45");
  assert.equal(formatRest(120), "2:00");
});

test("video URLs use youtube-nocookie embed and a plain watch link", () => {
  assert.equal(youtubeEmbedUrl("dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1");
  assert.equal(youtubeWatchUrl("a b"), "https://www.youtube.com/watch?v=a%20b");
  assert.ok(isPlaceholderVideo("mock-video-id"));
  assert.ok(!isPlaceholderVideo("dQw4w9WgXcQ"));
});
