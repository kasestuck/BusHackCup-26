import type { ComponentProps } from "react";
import { cx } from "./cx";

type Tone = "default" | "raised" | "feature";

const tones: Record<Tone, string> = {
  default: "bg-surface border border-line",
  raised: "bg-surface-2 border border-line-strong",
  /** Hero-weight card: lime hairline on top, slightly lifted */
  feature:
    "bg-surface border border-line-strong shadow-[inset_0_1px_0_rgb(200_255_69/0.35),0_24px_60px_-30px_rgb(0_0_0/0.8)]",
};

export function Card({
  tone = "default",
  interactive = false,
  className,
  ...rest
}: ComponentProps<"div"> & { tone?: Tone; interactive?: boolean }) {
  return (
    <div
      className={cx(
        "relative rounded-lg",
        tones[tone],
        interactive &&
          "transition-[border-color,background-color,transform] duration-300 ease-out-expo hover:border-white/20 hover:bg-surface-2/60",
        className,
      )}
      {...rest}
    />
  );
}
