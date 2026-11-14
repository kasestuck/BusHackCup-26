import { test } from "node:test";
import assert from "node:assert/strict";
import { checkImageFile, gramsToOz, macroSplit } from "./nutrition.ts";

test("checkImageFile accepts images up to 20 MB", () => {
  assert.equal(checkImageFile({ type: "image/jpeg", size: 4_000_000 }), null);
  assert.match(checkImageFile({ type: "application/pdf", size: 10 }) ?? "", /photo/);
  assert.match(checkImageFile({ type: "image/png", size: 21 * 1024 * 1024 }) ?? "", /20 MB/);
  assert.match(checkImageFile({ type: "image/png", size: 0 }) ?? "", /empty/);
});

test("macroSplit uses 4/4/9 kcal per gram and sums to 100", () => {
  const s = macroSplit({ kcal: 600, protein_g: 45, carbs_g: 60, fat_g: 20 });
  assert.deepEqual(s.map((x) => x.kcal), [180, 240, 180]);
  assert.equal(s.reduce((n, x) => n + x.pct, 0), 100);
  assert.deepEqual(s.map((x) => x.pct), [30, 40, 30]);
  const odd = macroSplit({ kcal: 0, protein_g: 1, carbs_g: 1, fat_g: 1 });
  assert.equal(odd.reduce((n, x) => n + x.pct, 0), 100);
  assert.deepEqual(macroSplit({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }).map((x) => x.pct), [0, 0, 0]);
});

test("gramsToOz", () => {
  assert.equal(gramsToOz(250), "8.8 oz");
  assert.equal(gramsToOz(28.35), "1.0 oz");
});
