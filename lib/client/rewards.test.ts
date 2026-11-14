import { test } from "node:test";
import assert from "node:assert/strict";
import type { Reward } from "@/lib/contract";
import { affordability, formatDate, sortRewards } from "./rewards.ts";

const r = (id: string, kind: Reward["kind"], cost: number, active = true): Reward => ({
  id,
  kind,
  title: id,
  partner_id: null,
  cost_coins: cost,
  discount_pct: null,
  active,
});

test("sortRewards puts Pro first, then cheapest, and drops inactive", () => {
  const sorted = sortRewards([r("p25", "partner_product", 900), r("pro", "pro_month", 1200), r("p15", "partner_product", 500), r("off", "partner_product", 10, false)]);
  assert.deepEqual(sorted.map((x) => x.id), ["pro", "p15", "p25"]);
});

test("affordability", () => {
  assert.deepEqual(affordability(r("a", "partner_product", 500), 640), { affordable: true, remaining: 0, progress: 1, balanceAfter: 140 });
  const pro = affordability(r("b", "pro_month", 1200), 600);
  assert.equal(pro.affordable, false);
  assert.equal(pro.remaining, 600);
  assert.equal(pro.progress, 0.5);
});

test("formatDate renders a US long date and tolerates bad input", () => {
  assert.equal(formatDate("2026-12-14T12:00:00.000Z"), "December 14, 2026");
  assert.equal(formatDate("not a date"), "not a date");
});
