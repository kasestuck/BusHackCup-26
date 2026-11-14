"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * Modal dialog on the native <dialog> element: focus trap, Esc to close,
 * inert background and top-layer stacking come from the browser.
 * On phones it docks to the bottom as a sheet.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** false while a request is in flight, so Esc/backdrop can't interrupt it */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel)
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
      className={cx(
        "m-0 mt-auto w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        "sm:m-auto sm:max-w-md",
        "open:animate-[su-rise_360ms_var(--su-ease-out)_both]",
      )}
    >
      <div className="pb-safe rounded-t-xl border border-line-strong bg-surface p-6 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)] sm:rounded-xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 id={titleId} className="font-display text-xl font-bold tracking-tight text-ink">
              {title}
            </h2>
            {description && (
              <div id={descId} className="text-sm leading-relaxed text-muted">
                {description}
              </div>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>
        {children}
      </div>
    </dialog>
  );
}
