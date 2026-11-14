import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage, isEmail, passwordProblem, safeNext } from "./auth-utils.ts";

test("safeNext keeps same-site paths and blocks open redirects", () => {
  assert.equal(safeNext("/plan?day=2"), "/plan?day=2");
  assert.equal(safeNext(null), "/dashboard");
  assert.equal(safeNext("https://evil.example"), "/dashboard");
  assert.equal(safeNext("//evil.example"), "/dashboard");
  assert.equal(safeNext("/\\evil.example"), "/dashboard");
  assert.equal(safeNext("/login"), "/dashboard");
  assert.equal(safeNext("/auth/callback?x=1"), "/dashboard");
  assert.equal(safeNext("/onboarding", "/x"), "/onboarding");
});

test("isEmail and passwordProblem", () => {
  assert.ok(isEmail("alex@example.com"));
  assert.ok(!isEmail("alex@example"));
  assert.ok(!isEmail("alex example.com"));
  assert.match(passwordProblem("short") ?? "", /8 characters/);
  assert.equal(passwordProblem("long-enough"), null);
});

test("authErrorMessage maps codes, then status", () => {
  assert.equal(authErrorMessage({ code: "invalid_credentials" }), "Email or password is incorrect.");
  assert.match(authErrorMessage({ code: "user_already_exists" }), /already exists/);
  assert.match(authErrorMessage({ code: "anonymous_provider_disabled" }), /Guest access is turned off/);
  assert.match(authErrorMessage({ status: 429 }), /Too many/);
  assert.match(authErrorMessage({ message: "Failed to fetch" }), /connection/);
  assert.match(authErrorMessage({ code: "something_new" }), /went wrong/);
});
