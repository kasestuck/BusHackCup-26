/**
 * Demo checkout input helpers (SPEC §7 "Payment (simulated)"). Pure — runs under `node --test`.
 * Card fields are formatted for feel only. They are never sent anywhere: the only request
 * is POST /api/billing/subscribe with {plan: "pro_monthly"}.
 */

const digits = (s: string) => s.replace(/\D/g, "");

/** "4242424242424242" → "4242 4242 4242 4242" (max 19 digits). */
export function formatCardNumber(input: string): string {
  return digits(input)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** "1228" → "12 / 28"; keeps a partial month while typing. */
export function formatExpiry(input: string): string {
  const d = digits(input).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)} / ${d.slice(2)}`;
}

export function formatCvc(input: string): string {
  return digits(input).slice(0, 4);
}

export function formatZip(input: string): string {
  return digits(input).slice(0, 5);
}

export type CardDraft = { name: string; number: string; expiry: string; cvc: string; zip: string };

/** Demo accepts any data — only checks each field has something, so the form feels real. */
export function missingFields(c: CardDraft): (keyof CardDraft)[] {
  return (Object.keys(c) as (keyof CardDraft)[]).filter((k) => c[k].trim() === "");
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
