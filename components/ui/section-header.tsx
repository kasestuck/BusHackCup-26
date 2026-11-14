import Link from "next/link";
import type { ReactNode } from "react";

/** Eyebrow + title row with an optional trailing link. */
export function SectionHeader({
  eyebrow,
  title,
  href,
  linkLabel,
  aside,
  id,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1.5">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 id={id} className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h2>
      </div>
      {aside}
      {href && linkLabel && (
        <Link
          href={href}
          className="group -my-3 inline-flex shrink-0 items-center gap-1 py-3 text-sm font-medium text-muted transition-colors hover:text-lime"
        >
          {linkLabel}
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      )}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-display text-eyebrow font-medium uppercase text-muted ${className ?? ""}`}>
      {children}
    </p>
  );
}
