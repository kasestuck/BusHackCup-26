"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps, type MouseEvent } from "react";
import { signOut } from "@/lib/client/auth";
import { Button, ButtonLink } from "@/components/ui/button";

/** /login?next=<where the user is now>, read at click time (no route hooks needed). */
function goToLogin(e: MouseEvent, push: (href: string) => void) {
  e.preventDefault();
  const here = `${window.location.pathname}${window.location.search}`;
  push(`/login?next=${encodeURIComponent(here)}`);
}

export function SignInButton(
  props: Omit<ComponentProps<typeof ButtonLink>, "href" | "children" | "onClick"> & { children?: React.ReactNode },
) {
  const router = useRouter();
  const { children = "Sign in", ...rest } = props;
  return (
    <ButtonLink href="/login" arrow onClick={(e) => goToLogin(e, router.push)} {...rest}>
      {children}
    </ButtonLink>
  );
}

export function SignInLink({ className, children = "Sign in" }: { className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link href="/login" onClick={(e) => goToLogin(e, router.push)} className={className}>
      {children}
    </Link>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 text-center">
      <Button
        variant="secondary"
        className={className}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await signOut();
          setBusy(false);
          if (res.ok) router.replace("/");
          else setError(res.message);
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
