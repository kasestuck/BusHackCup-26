"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { API_ROUTES, MeResponseSchema } from "@/lib/contract";
import { useApi } from "@/lib/client/use-api";
import { USE_MOCKS } from "@/lib/client/mocks";
import { formatNumber } from "@/lib/client/dashboard";
import { Wordmark } from "@/components/brand/wordmark";
import { cx } from "@/components/ui/cx";
import { Skeleton } from "@/components/ui/skeleton";
import { IconCalendar, IconCoin, IconGift, IconHome, IconUser } from "@/components/ui/icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconHome },
  { href: "/plan", label: "My Plan", icon: IconCalendar },
  { href: "/rewards", label: "Rewards", icon: IconGift },
  { href: "/profile", label: "Profile", icon: IconUser },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function MockBadge() {
  if (!USE_MOCKS) return null;
  return (
    <span
      title="NEXT_PUBLIC_USE_MOCKS=true — responses come from lib/client/mocks, not the live API"
      className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-warning/30 bg-warning-soft px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-warning"
    >
      <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
      Mock data
    </span>
  );
}

function initials(name: string | null | undefined) {
  if (!name) return "SU";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function AccountArea() {
  const [me] = useApi(API_ROUTES.me, MeResponseSchema);
  if (me.status === "loading") {
    return (
      <div className="flex items-center gap-3" aria-hidden="true">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="size-9 rounded-full" />
      </div>
    );
  }
  if (me.status === "error") return null;
  const { profile, coins_balance, is_pro } = me.data;
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href="/rewards"
        aria-label={`${formatNumber(coins_balance)} coins — open rewards`}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 font-display text-sm font-semibold tabular text-ink transition-colors hover:border-lime-line"
      >
        <IconCoin size={16} className="text-lime" />
        {formatNumber(coins_balance)}
      </Link>
      <Link
        href="/profile"
        aria-label="Your profile"
        className="relative grid size-9 place-items-center rounded-full border border-line-strong bg-surface-2 font-display text-[0.8125rem] font-bold text-ink transition-colors hover:border-white/25"
      >
        {initials(profile?.display_name)}
        {is_pro && (
          <span className="absolute -bottom-1 -right-1.5 rounded-xs bg-lime px-1 text-[0.5625rem] font-bold leading-[0.875rem] text-lime-ink">
            PRO
          </span>
        )}
      </Link>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const isActive = useIsActive();
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-lime focus:px-4 focus:py-2 focus:text-lime-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-4 sm:px-6 lg:h-[72px] lg:px-8">
          <Wordmark />
          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map(({ href, label }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "relative inline-flex h-10 items-center rounded-md px-3.5 text-[0.9375rem] font-medium transition-colors",
                        active ? "text-ink" : "text-muted hover:text-ink",
                      )}
                    >
                      {label}
                      <span
                        aria-hidden="true"
                        className={cx(
                          "absolute inset-x-3.5 -bottom-[13px] h-0.5 rounded-full bg-lime transition-opacity lg:-bottom-[17px]",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <MockBadge />
            <AccountArea />
          </div>
        </div>
      </header>

      <main id="main" className="pb-28 md:pb-16">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid h-[68px] max-w-md grid-cols-4 px-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex h-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors active:scale-95",
                    active ? "text-ink" : "text-subtle hover:text-muted",
                  )}
                >
                  <span
                    className={cx(
                      "grid h-8 w-12 place-items-center rounded-full transition-colors duration-300",
                      active ? "bg-lime text-lime-ink" : "",
                    )}
                  >
                    <Icon size={20} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
