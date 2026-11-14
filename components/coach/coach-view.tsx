"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { apiPost, type ApiError } from "@/lib/client/api";
import {
  ASSISTANT_ROUTE,
  AssistantResponseSchema,
  CHAT_HISTORY_MAX,
  CHAT_MESSAGE_MAX,
  type ChatMessage,
} from "@/lib/client/assistant-contract";
import { cleanDraft, toBlocks, trimHistory } from "@/lib/client/assistant";
import { LogoMark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section-header";
import { IconAlert, IconRefresh, IconShield } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { SignInButton } from "@/components/auth/sign-in";

const STORAGE_KEY = "showup.coach.thread";

const SUGGESTIONS = [
  "What's my workout today?",
  "I only have 20 minutes today",
  "How do I keep good form on squats?",
  "How do I earn coins faster?",
  "I don't feel like going today",
];

/** Per-tab convenience only: the thread survives navigation, not a closed tab. */
function loadThread(): ChatMessage[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      : [];
  } catch {
    return [];
  }
}
function saveThread(messages: ChatMessage[]) {
  try {
    if (messages.length) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the chat still works for this page view.
  }
}

function CoachAvatar() {
  return (
    <span className="mt-0.5 shrink-0" aria-hidden="true">
      <LogoMark size={30} />
    </span>
  );
}

function Reply({ content }: { content: string }) {
  return (
    <div className="min-w-0 flex-1 space-y-3 text-[0.9375rem] leading-relaxed text-ink">
      {toBlocks(content).map((b, i) =>
        b.type === "p" ? (
          <p key={i}>{b.text}</p>
        ) : b.type === "ul" ? (
          <ul key={i} className="space-y-1.5">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-lime" aria-hidden="true" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="space-y-1.5">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5">
                <span className="w-4 shrink-0 font-display text-sm font-bold tabular text-lime">{j + 1}</span>
                <span>{it}</span>
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-3" aria-label="Coach is typing">
      <CoachAvatar />
      <span className="flex gap-1.5 rounded-full border border-line bg-surface px-3.5 py-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-muted"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
    </svg>
  );
}

export function CoachView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const restored = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore this tab's thread after mount (sessionStorage is client-only).
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = loadThread();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
    if (saved.length) setMessages(saved);
  }, []);

  useEffect(() => {
    if (restored.current) saveThread(messages);
  }, [messages]);

  // Keep the newest message in view.
  useEffect(() => {
    if (messages.length || pending) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, pending, error]);

  // Auto-grow the composer up to ~6 lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [draft]);

  async function ask(thread: ChatMessage[]) {
    setPending(true);
    setError(null);
    const res = await apiPost(ASSISTANT_ROUTE, AssistantResponseSchema, {
      messages: trimHistory(thread, CHAT_HISTORY_MAX),
    });
    setPending(false);
    if (res.ok) setMessages([...thread, res.data.reply]);
    else setError(res.error);
  }

  function send(text: string) {
    const content = cleanDraft(text, CHAT_MESSAGE_MAX);
    if (!content || pending) return;
    const thread: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(thread);
    setDraft("");
    void ask(thread);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter adds a line. Ignore Enter while an IME is composing.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  }

  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";
  const remaining = CHAT_MESSAGE_MAX - draft.length;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[820px] flex-col px-4 pt-8 sm:px-6 sm:pt-12 lg:min-h-[calc(100dvh-72px)] lg:px-8">
      <header className="rise flex items-end justify-between gap-4">
        <div className="space-y-3">
          <Eyebrow>AI Coach</Eyebrow>
          <h1 className="font-display text-[clamp(2.25rem,1.6rem+2.6vw,3.5rem)] font-bold leading-[0.98] tracking-[-0.035em] text-ink">
            Ask your coach<span className="text-lime">.</span>
          </h1>
          <p className="max-w-[48ch] text-muted">
            Knows your plan, your schedule and your coins. Ask about today&apos;s workout, form, or how to fit
            training into a busy day.
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            className="h-10 shrink-0 text-sm"
            onClick={() => {
              setMessages([]);
              setError(null);
              inputRef.current?.focus();
            }}
            disabled={pending}
          >
            New chat
          </Button>
        )}
      </header>

      <div role="log" aria-live="polite" aria-label="Conversation with your AI coach" className="flex-1 space-y-7 py-8">
        {messages.length === 0 && !pending ? (
          <div className="rise space-y-5 rounded-lg border border-line bg-surface p-5 sm:p-6" style={{ ["--d" as string]: "80ms" }}>
            <div className="flex items-start gap-3">
              <CoachAvatar />
              <p className="text-[0.9375rem] leading-relaxed text-ink">
                Hi! I&apos;m your ShowUp coach. Tell me how much time you have, how you feel, or what you want to work
                on, and I&apos;ll help you make today count.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pl-[42px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-line-strong bg-surface-2 px-3.5 py-2 text-sm text-ink transition-colors hover:border-lime-line hover:bg-lime-soft active:scale-[0.97]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-xs border border-line-strong bg-surface-2 px-4 py-2.5 text-[0.9375rem] leading-relaxed text-ink [overflow-wrap:anywhere]">
                  {m.content}
                </p>
              </div>
            ) : (
              <div key={i} className="flex animate-fade gap-3">
                <CoachAvatar />
                <Reply content={m.content} />
              </div>
            ),
          )
        )}

        {pending && <Typing />}

        {error && lastIsUser && !pending && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-ink">
            <IconAlert size={17} className="shrink-0 text-danger" />
            <span className="min-w-0 flex-1">{error.message}</span>
            {error.status === 401 ? (
              <SignInButton variant="secondary" className="h-9 text-sm" />
            ) : (
              <Button variant="secondary" className="h-9 text-sm" icon={<IconRefresh size={15} />} onClick={() => ask(messages)}>
                Retry
              </Button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer: sticks above the mobile bottom nav, and to the bottom on desktop. */}
      <form
        onSubmit={onSubmit}
        className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 -mx-1 pb-3 md:bottom-0 md:pb-6"
      >
        <div className="rounded-lg border border-line-strong bg-surface/95 p-2 shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.7)] backdrop-blur-xl transition-colors focus-within:border-lime-line">
          <div className="flex items-end gap-2">
            <label htmlFor="coach-input" className="sr-only">
              Message your coach
            </label>
            <textarea
              id="coach-input"
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={CHAT_MESSAGE_MAX}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about your workout, form, or schedule…"
              className="max-h-[168px] min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-6 text-ink outline-none placeholder:text-subtle"
            />
            <button
              type="submit"
              disabled={!draft.trim() || pending}
              aria-label="Send message"
              className={cx(
                "grid size-11 shrink-0 place-items-center rounded-md transition-[background-color,transform] duration-200 active:scale-90",
                draft.trim() && !pending ? "bg-lime text-lime-ink hover:bg-lime-hover" : "bg-surface-3 text-subtle",
              )}
            >
              <SendIcon />
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-subtle">
          <span className="flex items-center gap-1.5">
            <IconShield size={13} className="shrink-0" />
            AI coach · general fitness guidance, not medical advice
          </span>
          {remaining < 200 && <span className="tabular" aria-live="polite">{remaining} left</span>}
        </div>
      </form>
    </div>
  );
}
