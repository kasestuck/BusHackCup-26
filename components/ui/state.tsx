import type { ReactNode } from "react";
import { cx } from "./cx";
import { IconAlert, IconLock, IconRefresh, IconWifiOff } from "./icons";
import { Button } from "./button";

/** Calm, centered empty state with an optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center text-center",
        compact ? "gap-3 px-4 py-8" : "gap-4 px-6 py-14",
        className,
      )}
    >
      {icon && (
        <div className="grid size-12 place-items-center rounded-md border border-line-strong bg-surface-2 text-lime">
          {icon}
        </div>
      )}
      <div className="max-w-sm space-y-1.5">
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h3>
        {description && <p className="text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export type ErrorKind = "network" | "auth" | "generic";

export function errorKindFromStatus(status: number): ErrorKind {
  if (status === 0) return "network";
  if (status === 401) return "auth";
  return "generic";
}

const errorCopy: Record<ErrorKind, { title: string; icon: ReactNode }> = {
  network: { title: "You're offline", icon: <IconWifiOff /> },
  auth: { title: "Sign in to continue", icon: <IconLock /> },
  generic: { title: "Something went wrong", icon: <IconAlert /> },
};

/** Error state with a retry action. Announced politely to screen readers. */
export function ErrorState({
  kind = "generic",
  message,
  onRetry,
  action,
  compact = false,
  className,
}: {
  kind?: ErrorKind;
  message: string;
  onRetry?: () => void;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const copy = errorCopy[kind];
  return (
    <div role="alert" className={className}>
      <EmptyState
        compact={compact}
        icon={<span className={kind === "generic" ? "text-danger" : "text-muted"}>{copy.icon}</span>}
        title={copy.title}
        description={message}
        action={
          action ??
          (onRetry && (
            <Button variant="secondary" onClick={onRetry} icon={<IconRefresh size={18} />}>
              Try again
            </Button>
          ))
        }
      />
    </div>
  );
}
