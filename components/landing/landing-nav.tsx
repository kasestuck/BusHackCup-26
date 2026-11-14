import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ButtonLink } from "@/components/ui/button";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#rewards", label: "Rewards" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <Wordmark href="/" />
        <nav aria-label="Sections" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="inline-flex h-10 items-center rounded-md px-3.5 text-[0.9375rem] font-medium text-muted transition-colors hover:text-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="hidden h-10 items-center rounded-md px-3.5 text-[0.9375rem] font-medium text-muted transition-colors hover:text-ink sm:inline-flex"
          >
            Log in
          </Link>
          <ButtonLink href="/signup" className="h-10 px-4 text-sm">
            Get started
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
