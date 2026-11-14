import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { EARN_RULES } from "@/lib/client/economy";

/** Split auth layout: brand story on the left (desktop), focused form on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const checkin = EARN_RULES.find((r) => r.key === "checkin")!;
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <aside className="grain relative hidden overflow-hidden border-r border-line bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-1/3 size-[480px] rounded-full bg-lime/10 blur-3xl" />
        <Wordmark href="/" />
        <div className="relative space-y-6">
          <p className="font-display text-[clamp(2.5rem,1.5rem+2.4vw,4rem)] font-bold leading-[0.98] tracking-[-0.04em] text-ink">
            <span className="text-muted">You pay for the gym.</span>
            <br />
            We make sure you actually go<span className="text-lime">.</span>
          </p>
          <p className="max-w-[40ch] text-muted">
            An AI plan around your week, and{" "}
            <span className="font-semibold text-lime">+{checkin.coins} coins</span> every time you check in at a partner
            gym.
          </p>
        </div>
        <p className="relative text-xs text-subtle">General fitness guidance, not medical advice.</p>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-16 items-center px-4 sm:px-6 lg:hidden">
          <Wordmark href="/" />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="rise w-full max-w-[420px]">{children}</div>
        </main>
        <footer className="px-4 pb-6 text-center text-xs text-subtle sm:px-6">
          <Link href="/privacy" className="inline-flex h-10 items-center px-2 hover:text-ink">
            How we handle your data
          </Link>
        </footer>
      </div>
    </div>
  );
}
