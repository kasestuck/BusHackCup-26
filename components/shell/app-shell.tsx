"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { API_ROUTES, MeResponseSchema } from "@/lib/contract";
import { useApi } from "@/lib/client/use-api";
import { USE_MOCKS } from "@/lib/client/mocks";
import { formatNumber } from "@/lib/client/dashboard";
import { Wordmark } from "@/components/brand/wordmark";
import { cx } from "@/components/ui/cx";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconBowl,
  IconCalendar,
  IconChat,
  IconCoin,
  IconGift,
  IconHome,
  IconMapPin,
  IconUser,
} from "@/components/ui/icons";

/** `mobile: false` items stay out of the 5-slot bottom bar (Profile is the header avatar there). */
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconHome, mobile: true },
  { href: "/plan", label: "My Plan", icon: IconCalendar, mobile: true },
  { href: "/coach", label: "Coach", icon: IconChat, mobile: true },
  { href: "/nutrition", label: "Nutrition", icon: IconBowl, mobile: true },
  { href: "/rewards", label: "Rewards", icon: IconGift, mobile: true },
  { href: "/profile", label: "Profile", icon: IconUser, mobile: false },
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
      <span>Mock</span>
      <span className="-ml-0.5 hidden sm:inline lg:hidden xl:inline">data</span>
    </span>
  );
}

/**
 * Gym check-in is the core P0 action (+40 coins, streak), so it's always one tap away:
 * labelled lime button on larger screens, compact icon button on phones.
 */
function CheckInButton() {
  return (
    <Link
      href="/checkin"
      aria-label="Gym check-in"
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-lime px-2.5 font-display text-sm font-semibold text-lime-ink shadow-[0_0_0_1px_rgb(200_255_69/0.4),0_8px_24px_-12px_rgb(200_255_69/0.6)] transition-[background-color,transform] duration-200 hover:bg-lime-hover active:scale-95 sm:px-3.5 lg:px-2.5 xl:px-3.5"
    >
      <IconMapPin size={17} />
      <span className="hidden sm:inline lg:hidden xl:inline">Check in</span>
    </Link>
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

type IsActive = (href: string) => boolean;
const NONE_ACTIVE: IsActive = () => false;

function TopNavLinks({ isActive }: { isActive: IsActive }) {
  return (
    <ul className="flex items-center gap-1">
      {NAV.map(({ href, label }) => {
        const active = isActive(href);
        return (
          // Profile is also the header avatar, so it gives up its slot on narrow desktops (1024–1279px).
          <li key={href} className={href === "/profile" ? "hidden xl:list-item" : undefined}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative inline-flex h-10 items-center rounded-md px-2.5 text-[0.9375rem] xl:px-3.5 font-medium transition-colors",
                active ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              {label}
              <span
                aria-hidden="true"
                className={cx(
                  "absolute inset-x-2.5 -bottom-[13px] xl:inset-x-3.5 h-0.5 rounded-full bg-lime transition-opacity lg:-bottom-[17px]",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function BottomNavLinks({ isActive }: { isActive: IsActive }) {
  return (
    <ul className="mx-auto grid h-[68px] max-w-md grid-cols-5 px-1">
      {NAV.filter((n) => n.mobile).map(({ href, label, icon: Icon }) => {
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
                  "grid h-8 w-11 place-items-center rounded-full transition-colors duration-300",
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
  );
}

/* usePathname() needs a Suspense boundary on dynamic routes (e.g. /workout/[day]) under
   Cache Components; the fallback renders the same links without an active state. */
function ActiveTopNav() {
  return <TopNavLinks isActive={useIsActive()} />;
}
function ActiveBottomNav() {
  return <BottomNavLinks isActive={useIsActive()} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-lime focus:px-4 focus:py-2 focus:text-lime-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-4 sm:px-6 lg:h-[72px] lg:px-8 xl:gap-6">
          <Wordmark compact />
          <nav aria-label="Primary" className="hidden lg:block">
            <Suspense fallback={<TopNavLinks isActive={NONE_ACTIVE} />}>
              <ActiveTopNav />
            </Suspense>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <MockBadge />
            <CheckInButton />
            <AccountArea />
          </div>
        </div>
      </header>

      <main id="main" className="pb-28 lg:pb-16">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl lg:hidden"
      >
        <Suspense fallback={<BottomNavLinks isActive={NONE_ACTIVE} />}>
          <ActiveBottomNav />
        </Suspense>
      </nav>
    </div>
  );
}
