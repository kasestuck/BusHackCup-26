import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCardNumber, formatCvc, formatExpiry, formatUsd, formatZip, missingFields } from "./checkout.ts";

test("card number groups by 4 and caps at 19 digits", () => {
  assert.equal(formatCardNumber("4242424242424242"), "4242 4242 4242 4242");
  assert.equal(formatCardNumber("4242-42"), "4242 42");
  assert.equal(formatCardNumber("1".repeat(25)).replace(/ /g, "").length, 19);
});

test("expiry, cvc and zip keep digits only", () => {
  assert.equal(formatExpiry("12"), "12");
  assert.equal(formatExpiry("1228"), "12 / 28");
  assert.equal(formatExpiry("12/2899"), "12 / 28");
  assert.equal(formatCvc("12a34x5"), "1234");
  assert.equal(formatZip("78701-1234"), "78701");
});

test("missingFields lists empty fields only", () => {
  assert.deepEqual(missingFields({ name: "A", number: " ", expiry: "1", cvc: "", zip: "1" }), ["number", "cvc"]);
});

test("formatUsd", () => {
  assert.equal(formatUsd(12.99), "$12.99");
});
