import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-display font-semibold tracking-[-0.01em] transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-out-expo active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary:
    "bg-lime text-lime-ink hover:bg-lime-hover shadow-[0_0_0_1px_rgb(200_255_69/0.4),0_10px_30px_-12px_rgb(200_255_69/0.55)]",
  secondary:
    "bg-surface-2 text-ink border border-line-strong hover:bg-surface-3 hover:border-white/20",
  ghost: "text-muted hover:text-ink hover:bg-white/5",
};

const sizes: Record<Size, string> = {
  md: "h-11 rounded-md px-4 text-[0.9375rem]",
  lg: "h-13 rounded-md px-6 text-base",
};

type Common = {
  variant?: Variant;
  size?: Size;
  /** Trailing arrow that nudges on hover */
  arrow?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

function Inner({ icon, arrow, children }: Pick<Common, "icon" | "arrow" | "children">) {
  return (
    <>
      {icon}
      <span>{children}</span>
      {arrow && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="transition-transform duration-200 ease-out-expo group-hover/btn:translate-x-0.5"
        >
          <path d="M4.5 12h15M13.5 6l6 6-6 6" />
        </svg>
      )}
    </>
  );
}

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: Pick<Common, "variant" | "size" | "className">) {
  return cx(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  arrow,
  icon,
  className,
  children,
  ...rest
}: Common & Omit<ComponentProps<"button">, keyof Common>) {
  return (
    <button type="button" className={buttonClass({ variant, size, className })} {...rest}>
      <Inner icon={icon} arrow={arrow}>
        {children}
      </Inner>
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  arrow,
  icon,
  className,
  children,
  ...rest
}: Common & Omit<ComponentProps<typeof Link>, keyof Common>) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...rest}>
      <Inner icon={icon} arrow={arrow}>
        {children}
      </Inner>
    </Link>
  );
}
