"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { USE_MOCKS } from "@/lib/client/mocks";
import { cx } from "@/components/ui/cx";

/**
 * Focused header for full-screen flows: brand, segmented progress (or custom
 * center content), exit. `exitConfirm` asks before leaving with unsaved work.
 */
export function FlowHeader({
  current,
  total,
  center,
  exitHref = "/dashboard",
  exitConfirm,
}: {
  current?: number;
  total?: number;
  center?: ReactNode;
  exitHref?: string;
  exitConfirm?: string;
}) {
  const hasSteps = current !== undefined && total !== undefined;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Wordmark />
        {hasSteps && (
          <div className="mx-auto hidden w-full max-w-xs items-center gap-1 sm:flex" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={cx(
                  "h-1 flex-1 rounded-full transition-colors duration-500",
                  i <= current ? "bg-lime" : "bg-white/10",
                )}
              />
            ))}
          </div>
        )}
        {center && <div className="mx-auto">{center}</div>}
        <div className={cx("flex items-center gap-3", !center && "ml-auto")}>
          {USE_MOCKS && (
            <span className="hidden h-6 items-center rounded-sm border border-warning/30 bg-warning-soft px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-warning sm:inline-flex">
              Mock data
            </span>
          )}
          <Link
            href={exitHref}
            onClick={(e) => {
              if (exitConfirm && !window.confirm(exitConfirm)) e.preventDefault();
            }}
            className="inline-flex h-10 items-center rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            Exit
          </Link>
        </div>
      </div>
      {hasSteps && (
        <div className="h-0.5 bg-white/5 sm:hidden" aria-hidden="true">
          <div
            className="h-full bg-lime transition-[width] duration-500 ease-out-expo"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      )}
    </header>
  );
}
