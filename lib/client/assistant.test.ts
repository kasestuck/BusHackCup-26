import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChatMessage } from "./assistant-contract.ts";
import { cleanDraft, toBlocks, trimHistory } from "./assistant.ts";

const u = (content: string): ChatMessage => ({ role: "user", content });
const a = (content: string): ChatMessage => ({ role: "assistant", content });

test("trimHistory keeps the last N and starts on a user message", () => {
  const msgs = [u("1"), a("2"), u("3"), a("4"), u("5")];
  assert.deepEqual(trimHistory(msgs, 3), [u("3"), a("4"), u("5")]);
  assert.deepEqual(trimHistory(msgs, 2), [u("5")]);
  assert.deepEqual(trimHistory([a("hi")], 5), []);
});

test("toBlocks splits paragraphs and bullet / numbered lists", () => {
  assert.deepEqual(toBlocks("Hello there.\n\n- one\n- two\nAfter."), [
    { type: "p", text: "Hello there." },
    { type: "ul", items: ["one", "two"] },
    { type: "p", text: "After." },
  ]);
  assert.deepEqual(toBlocks("1. a\n2) b"), [{ type: "ol", items: ["a", "b"] }]);
  assert.deepEqual(toBlocks("<b>not html</b>"), [{ type: "p", text: "<b>not html</b>" }]);
});

test("cleanDraft trims and caps", () => {
  assert.equal(cleanDraft("  hi  ", 10), "hi");
  assert.equal(cleanDraft("x".repeat(20), 5), "xxxxx");
  assert.equal(cleanDraft("   ", 5), "");
});
