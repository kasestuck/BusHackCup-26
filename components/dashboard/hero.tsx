import type { MeResponse, Plan } from "@/lib/contract";
import { WEEKDAY_LONG, greeting, isoWeekday } from "@/lib/client/dashboard";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section-header";
import { IconPlay } from "@/components/ui/icons";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });

export function Hero({
  me,
  plan,
  today,
  startHref,
}: {
  me: MeResponse;
  plan: Plan | null;
  today: Date;
  startHref: string | null;
}) {
  const name = me.profile?.display_name;
  const onboarded = me.profile !== null;

  return (
    <div className="rise flex h-full flex-col justify-between gap-10">
      <div className="space-y-6">
        <Eyebrow>
          {greeting(today)}
          {name ? `, ${name}` : ""} <span className="px-1.5 text-subtle">/</span>
          {WEEKDAY_LONG[isoWeekday(today) - 1]}, {dateFmt.format(today)}
        </Eyebrow>

        <h1 className="max-w-[11ch] font-display text-hero font-bold text-ink">
          Your next workout starts here<span className="text-lime">.</span>
        </h1>

        <p className="max-w-[38ch] text-lg leading-relaxed text-muted sm:text-xl">
          {plan
            ? "Your plan is ready. Show up, put in the work, earn your rewards."
            : onboarded
              ? "Your profile is set. Generate your AI plan and start earning for every visit."
              : "Tell us your schedule and goals. We'll build your plan, then pay you to show up."}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          {plan && startHref ? (
            <ButtonLink href={startHref} size="lg" icon={<IconPlay size={18} />}>
              Start Workout
            </ButtonLink>
          ) : (
            <ButtonLink href={onboarded ? "/plan" : "/onboarding"} size="lg" arrow>
              {onboarded ? "Generate my plan" : "Build my plan"}
            </ButtonLink>
          )}
          {plan && (
            <ButtonLink href="/plan" variant="secondary" size="lg">
              View my plan
            </ButtonLink>
          )}
        </div>
        {plan && (
          <p className="text-sm text-subtle">
            <span className="font-medium text-muted">{plan.title}</span>
            <span className="px-2">·</span>
            {plan.summary}
          </p>
        )}
      </div>
    </div>
  );
}
