import Link from "next/link";
import { cx } from "@/components/ui/cx";

/**
 * ShowUp mark: a forward-leaning lime chevron "step" — the act of showing up.
 * Wordmark is set in Space Grotesk with tight tracking.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="7" fill="var(--su-lime)" />
      <path d="M9 21.5 15.2 10.5h4.3L13.3 21.5H9Z" fill="var(--su-lime-ink)" />
      <path d="M16.6 21.5 22.8 10.5H24l-6.2 11h-1.2Z" fill="var(--su-lime-ink)" opacity="0.55" />
    </svg>
  );
}

export function Wordmark({ className, href = "/dashboard" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="ShowUp home"
      className={cx("inline-flex items-center gap-2.5 rounded-sm", className)}
    >
      <LogoMark />
      <span className="font-display text-[1.2rem] font-bold tracking-[-0.04em] text-ink">
        Show<span className="text-lime">Up</span>
      </span>
    </Link>
  );
}
