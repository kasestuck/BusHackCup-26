import type { ReactNode } from "react";
import { cx } from "./cx";

type Tone = "neutral" | "lime" | "solid" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-muted border-line",
  lime: "bg-lime-soft text-lime border-lime-line",
  solid: "bg-lime text-lime-ink border-transparent",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-xs font-medium tracking-wide",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
