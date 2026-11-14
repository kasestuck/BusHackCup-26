import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Selectable controls built on native radio/checkbox inputs, so keyboard,
 * form and screen-reader behaviour come for free. Wrap a set in <ChoiceGroup>.
 */

type Base = {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  type?: "radio" | "checkbox";
  disabled?: boolean;
};

function Check({ checked, round }: { checked: boolean; round: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid size-5 shrink-0 place-items-center border transition-colors duration-200",
        round ? "rounded-full" : "rounded-xs",
        checked ? "border-lime bg-lime text-lime-ink" : "border-line-strong bg-bg/40",
      )}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      )}
    </span>
  );
}

const shell =
  "relative cursor-pointer select-none border transition-[background-color,border-color,transform] duration-200 ease-out-expo active:scale-[0.985] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lime has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";

const states = (checked: boolean) =>
  checked
    ? "border-lime-line bg-lime-soft"
    : "border-line bg-surface hover:border-line-strong hover:bg-surface-2";

/** Large option with title, description and optional leading visual. */
export function ChoiceCard({
  title,
  description,
  visual,
  type = "radio",
  className,
  ...input
}: Base & { title: string; description?: string; visual?: ReactNode; className?: string }) {
  return (
    <label className={cx(shell, states(input.checked), "flex items-start gap-4 rounded-lg p-4 sm:p-5", className)}>
      <input type={type} className="sr-only" {...input} />
      {visual && (
        <span
          aria-hidden="true"
          className={cx(
            "grid size-11 shrink-0 place-items-center rounded-md border transition-colors duration-200",
            input.checked ? "border-lime-line bg-lime/15 text-lime" : "border-line bg-surface-2 text-muted",
          )}
        >
          {visual}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-semibold text-ink">{title}</span>
        {description && <span className="mt-1 block text-sm leading-relaxed text-muted">{description}</span>}
      </span>
      <Check checked={input.checked} round={type === "radio"} />
    </label>
  );
}

/** Compact pill option (weekdays, minutes, areas). */
export function ChoiceChip({
  label,
  sublabel,
  type = "radio",
  size = "md",
  className,
  ...input
}: Base & { label: ReactNode; sublabel?: string; size?: "md" | "lg"; className?: string }) {
  return (
    <label
      className={cx(
        shell,
        "flex flex-col items-center justify-center rounded-md text-center",
        size === "lg" ? "min-h-20 px-3 py-3" : "min-h-11 px-3.5 py-2",
        input.checked ? "border-lime bg-lime text-lime-ink" : "border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2",
        className,
      )}
    >
      <input type={type} className="sr-only" {...input} />
      <span className={cx("font-display font-semibold tabular", size === "lg" ? "text-2xl tracking-tight" : "text-sm")}>
        {label}
      </span>
      {sublabel && (
        <span className={cx("mt-0.5 text-xs", input.checked ? "text-lime-ink/70" : "text-muted")}>{sublabel}</span>
      )}
    </label>
  );
}

/** Fieldset with an accessible legend and an error slot. */
export function ChoiceGroup({
  legend,
  hint,
  error,
  hideLegend = false,
  className,
  children,
}: {
  legend: string;
  hint?: string;
  error?: string;
  hideLegend?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={cx("min-w-0 space-y-3", className)}>
      <legend className={cx("mb-3 text-sm font-medium text-ink", hideLegend && "sr-only")}>{legend}</legend>
      {hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
