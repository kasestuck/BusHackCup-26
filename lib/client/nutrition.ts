/**
 * Nutrition analysis helpers (SPEC §8 "Nutrition analysis from a photo"). Pure — runs under `node --test`.
 * Results are an approximate estimate, never shown as exact.
 */
import type { NutritionResponse } from "@/lib/contract";

/** Largest original photo we accept before downscaling. Modern phone photos are 3–12 MB. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function checkImageFile(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith("image/")) return "Choose a photo (JPG, PNG, HEIC or WebP).";
  if (file.size > MAX_UPLOAD_BYTES) return "That photo is over 20 MB. Try a smaller one.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

export type MacroShare = { key: "protein" | "carbs" | "fat"; label: string; grams: number; kcal: number; pct: number };

/** Share of calories from each macro (4 / 4 / 9 kcal per gram). Percentages sum to 100 (or 0). */
export function macroSplit(t: NutritionResponse["totals"]): MacroShare[] {
  const rows = [
    { key: "protein" as const, label: "Protein", grams: t.protein_g, kcal: t.protein_g * 4 },
    { key: "carbs" as const, label: "Carbs", grams: t.carbs_g, kcal: t.carbs_g * 4 },
    { key: "fat" as const, label: "Fat", grams: t.fat_g, kcal: t.fat_g * 9 },
  ];
  const total = rows.reduce((n, r) => n + r.kcal, 0);
  if (total <= 0) return rows.map((r) => ({ ...r, pct: 0 }));
  const pcts = rows.map((r) => Math.round((r.kcal / total) * 100));
  // Fix rounding drift so the bar always fills exactly.
  pcts[pcts.indexOf(Math.max(...pcts))] += 100 - pcts.reduce((a, b) => a + b, 0);
  return rows.map((r, i) => ({ ...r, pct: pcts[i] }));
}

/** 250 → "8.8 oz" (US readers think in ounces). */
export function gramsToOz(g: number): string {
  return `${(g / 28.349523125).toFixed(1)} oz`;
}

export function round(n: number): number {
  return Math.round(n);
}
