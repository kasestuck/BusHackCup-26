import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePartnerStats, formatCents } from "./partner.ts";

test("formatCents renders USD from integer cents", () => {
  assert.equal(formatCents(64788), "$647.88");
  assert.equal(formatCents(0), "$0.00");
  assert.equal(formatCents(250_000_00, { compact: true }), "$250K");
});

test("derivePartnerStats: AOV, effective rate, net", () => {
  assert.deepEqual(derivePartnerStats({ sales_count: 12, revenue_cents: 64788, commission_cents: 9718 }), {
    aovCents: 5399,
    ratePct: 15,
    netCents: 55070,
  });
  assert.deepEqual(derivePartnerStats({ sales_count: 0, revenue_cents: 0, commission_cents: 0 }), {
    aovCents: null,
    ratePct: null,
    netCents: 0,
  });
});
