/**
 * AI Coach chat helpers. Pure — runs under `node --test`.
 */
import type { ChatMessage } from "./assistant-contract.ts";

/** Keep the last `max` messages, and never start the context with an assistant reply. */
export function trimHistory(messages: ChatMessage[], max: number): ChatMessage[] {
  const recent = messages.slice(-max);
  const firstUser = recent.findIndex((m) => m.role === "user");
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

export type Block = { type: "p"; text: string } | { type: "ul"; items: string[] } | { type: "ol"; items: string[] };

/**
 * Turns a plain-text reply into paragraphs and lists ("- item", "1. item").
 * Rendered as React text — never as HTML — so model output can't inject markup.
 */
export function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of content.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    let para: string[] = [];
    const flush = () => {
      if (para.length) blocks.push({ type: "p", text: para.join(" ") });
      para = [];
    };
    for (const line of lines) {
      const bullet = line.match(/^[-*•]\s+(.*)$/);
      const numbered = line.match(/^\d+[.)]\s+(.*)$/);
      const item = bullet?.[1] ?? numbered?.[1];
      const kind = bullet ? "ul" : numbered ? "ol" : null;
      if (item !== undefined && kind) {
        flush();
        const last = blocks[blocks.length - 1];
        if (last && last.type === kind) last.items.push(item);
        else blocks.push({ type: kind, items: [item] });
      } else {
        para.push(line);
      }
    }
    flush();
  }
  return blocks;
}

/** Strip and cap a draft before sending. Empty means "don't send". */
export function cleanDraft(draft: string, max: number): string {
  return draft.trim().slice(0, max);
}
