import { cx } from "./cx";

/** Shimmering placeholder block. Hidden from assistive tech; wrap groups with aria-busy. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("skeleton rounded-sm", className)} />;
}
