import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * Labelled text field. `suffix` renders a unit inside the field (e.g. "lb", "ft").
 * Errors are linked via aria-describedby.
 */
export function Input({
  label,
  hint,
  error,
  suffix,
  trailing,
  className,
  id,
  ...rest
}: ComponentProps<"input"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  suffix?: string;
  /** Interactive element inside the field's right edge (e.g. show/hide password). */
  trailing?: ReactNode;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errId = `${inputId}-err`;
  return (
    <div className={cx("space-y-2", className)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div
        className={cx(
          "flex h-12 items-center rounded-md border bg-surface-2 transition-colors duration-200 focus-within:border-lime focus-within:bg-surface-3",
          error ? "border-danger/60" : "border-line-strong hover:border-white/20",
        )}
      >
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(hint ? hintId : null, error ? errId : null) || undefined}
          className="h-full w-full min-w-0 bg-transparent px-4 text-base text-ink outline-none placeholder:text-subtle"
          {...rest}
        />
        {suffix && <span className="pr-4 text-sm font-medium text-muted">{suffix}</span>}
        {trailing && <span className="flex shrink-0 items-center pr-1.5">{trailing}</span>}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
