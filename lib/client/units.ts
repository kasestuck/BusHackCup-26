/** US units in the UI, metric in the API (SPEC §5). Pure, no imports. */

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function ftInToCm(ft: number, inches: number): number {
  return round1((ft * 12 + inches) * CM_PER_INCH);
}

export function cmToFtIn(cm: number): { ft: number; in: number } {
  const total = Math.round(cm / CM_PER_INCH);
  return { ft: Math.floor(total / 12), in: total % 12 };
}

export function lbToKg(lb: number): number {
  return round1(lb * KG_PER_LB);
}

export function kgToLb(kg: number): number {
  return Math.round(kg / KG_PER_LB);
}
