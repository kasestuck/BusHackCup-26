"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AUTH_MODE,
  continueAsGuest,
  mockMagicLinkUrl,
  sendMagicLink,
  signInWithPassword,
  signUp,
} from "@/lib/client/auth";
import { isEmail, passwordProblem, safeNext, MIN_PASSWORD } from "@/lib/client/auth-utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconAlert } from "@/components/ui/icons";

function ModeNotice() {
  if (AUTH_MODE === "supabase") return null;
  return AUTH_MODE === "mock" ? (
    <p role="note" className="rounded-md border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-xs text-warning">
      Mock mode: any email and password work, and no email is sent.
    </p>
  ) : (
    <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs text-ink">
      Sign-in isn&apos;t configured. Add the Supabase URL and anon key to the environment.
    </p>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-ink">
      <IconAlert size={17} className="mt-px shrink-0 text-danger" />
      {message}
    </p>
  );
}

function PasswordField({
  value,
  onChange,
  error,
  autoComplete,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Input
      label="Password"
      type={show ? "text" : "password"}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-label={show ? "Hide password" : "Show password"}
          className="h-9 rounded-sm px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-ink"
        >
          {show ? "Hide" : "Show"}
        </button>
      }
    />
  );
}

/**
 * One-click access without an email (hackathon judges, quick demos).
 * Real anonymous Supabase session; guests start at onboarding.
 */
function GuestAccess() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        size="lg"
        className="w-full border-lime-line hover:border-lime"
        disabled={busy || AUTH_MODE === "unconfigured"}
        aria-busy={busy || undefined}
        arrow={!busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await continueAsGuest();
          setBusy(false);
          if (res.ok) router.replace("/onboarding");
          else setError(res.message);
        }}
      >
        {busy ? "Opening ShowUp…" : "Continue without an account"}
      </Button>
      <p className="text-center text-xs text-subtle">No email or password. Jump straight in as a guest.</p>
      <FormError message={error} />
      <div className="flex items-center gap-3 pt-1 text-xs uppercase tracking-[0.12em] text-subtle" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or use your email
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

/** "Check your inbox" panel after a magic link or a sign-up that needs confirmation. */
function CheckInbox({ email, next, onBack, kind }: { email: string; next: string; onBack: () => void; kind: "link" | "confirm" }) {
  return (
    <div className="space-y-6">
      <span className="grid size-12 place-items-center rounded-md bg-lime text-lime-ink" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3.5 6.5 8.5 6 8.5-6" />
        </svg>
      </span>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Check your inbox.</h1>
        <p className="text-muted" aria-live="polite">
          {kind === "link" ? "We sent a sign-in link to " : "We sent a confirmation link to "}
          <span className="font-medium text-ink">{email}</span>. It opens ShowUp and signs you in.
        </p>
      </div>
      {AUTH_MODE === "mock" && (
        <ButtonLink href={mockMagicLinkUrl(next)} variant="secondary" className="w-full" arrow>
          Open the mock email link
        </ButtonLink>
      )}
      <Button variant="ghost" onClick={onBack} className="w-full">
        Use a different email
      </Button>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailError = tried && !isEmail(email) ? "Enter a valid email." : undefined;
  const passwordError = tried && mode === "password" && password.length === 0 ? "Enter your password." : undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (!isEmail(email) || (mode === "password" && !password)) return;
    setBusy(true);
    const res = mode === "password" ? await signInWithPassword(email, password) : await sendMagicLink(email, next);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    if (mode === "link") {
      setSent(true);
      return;
    }
    router.replace(next);
  }

  if (sent) return <CheckInbox email={email} next={next} kind="link" onBack={() => setSent(false)} />;

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-[-0.03em] text-ink">
          Welcome back<span className="text-lime">.</span>
        </h1>
        <p className="text-muted">Log in to see today&apos;s workout, your streak and your coins.</p>
      </div>
      <ModeNotice />
      <GuestAccess />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        {mode === "password" && (
          <PasswordField value={password} onChange={setPassword} error={passwordError} autoComplete="current-password" />
        )}
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy} aria-busy={busy || undefined}>
          {busy ? (mode === "password" ? "Logging in…" : "Sending link…") : mode === "password" ? "Log in" : "Email me a sign-in link"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "password" ? "link" : "password"));
            setError(null);
            setTried(false);
          }}
          className="mx-auto block h-10 rounded-sm px-2 text-sm font-medium text-lime"
        >
          {mode === "password" ? "Email me a sign-in link instead" : "Use my password instead"}
        </button>
      </form>
      <p className="border-t border-line pt-6 text-center text-sm text-muted">
        New to ShowUp?{" "}
        <Link href={`/signup${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="-my-3 inline-block py-3 font-semibold text-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailError = tried && !isEmail(email) ? "Enter a valid email." : undefined;
  const pwProblem = passwordProblem(password);
  const passwordError = tried && pwProblem ? pwProblem : undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (!isEmail(email) || pwProblem) return;
    setBusy(true);
    const res = await signUp(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    if (res.needsConfirmation) {
      setSent(true);
      return;
    }
    // New accounts go straight to the questionnaire (SPEC §3 #2).
    router.replace("/onboarding");
  }

  if (sent) return <CheckInbox email={email} next="/onboarding" kind="confirm" onBack={() => setSent(false)} />;

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-[-0.03em] text-ink">
          Start showing up<span className="text-lime">.</span>
        </h1>
        <p className="text-muted">Create your account, then two minutes of questions for your AI plan.</p>
      </div>
      <ModeNotice />
      <GuestAccess />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <PasswordField
          value={password}
          onChange={setPassword}
          error={passwordError}
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD} characters.`}
        />
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy} aria-busy={busy || undefined} arrow={!busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-subtle">
          Free to start. ShowUp gives general fitness guidance, not medical advice.
        </p>
      </form>
      <p className="border-t border-line pt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="-my-3 inline-block py-3 font-semibold text-ink underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
