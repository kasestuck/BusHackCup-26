import { LogoMark } from "@/components/brand/wordmark";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/section-header";
import { IconCalendar, IconChat, IconShield } from "@/components/ui/icons";

const container = "mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8";

const POINTS = [
  {
    icon: <IconCalendar size={18} />,
    title: "Knows your plan",
    body: "Your schedule, today's workout, your streak and your coins are already in the conversation.",
  },
  {
    icon: <IconChat size={18} />,
    title: "Adapts on the spot",
    body: "Only 20 minutes? Low on energy? It reshapes today's session so you still show up.",
  },
  {
    icon: <IconShield size={18} />,
    title: "Safety first",
    body: "Form cues and technique videos from our verified catalog. For pain or injuries it tells you to see a doctor.",
  },
];

/** Illustrative exchange — marked as an example, not anyone's data. */
function ChatPreview() {
  return (
    <figure className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-8 rounded-full bg-lime/10 blur-3xl" />
      <Card tone="feature" className="relative space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <span className="font-display font-semibold text-ink">AI Coach</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
            Knows your plan
          </span>
        </div>
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-lg rounded-br-xs border border-line-strong bg-surface-2 px-4 py-2.5 text-[0.9375rem] text-ink">
            I only have 20 minutes today.
          </p>
        </div>
        <div className="flex gap-3">
          <span className="mt-0.5 shrink-0" aria-hidden="true">
            <LogoMark size={26} />
          </span>
          <div className="space-y-2.5 text-[0.9375rem] leading-relaxed text-ink">
            <p>Here&apos;s a 20-minute version of today&apos;s Lower body:</p>
            <ul className="space-y-1.5">
              {["Goblet Squat: 2 × 8–10", "Romanian Deadlift: 2 × 8–10", "Walking Lunge: 2 × 10 each leg"].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-lime" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="text-muted">Still log it: it counts for your streak and coins.</p>
          </div>
        </div>
      </Card>
      <figcaption className="mt-4 text-center text-xs text-subtle">Example conversation for illustration</figcaption>
    </figure>
  );
}

export function CoachSection() {
  return (
    <section id="coach" aria-labelledby="coach-heading" className={`${container} scroll-mt-20 py-20 lg:py-28`}>
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="space-y-8 lg:col-span-6">
          <div className="space-y-4">
            <Eyebrow>AI Coach</Eyebrow>
            <h2 id="coach-heading" className="font-display text-title font-bold text-ink">
              A coach in your pocket that knows your week<span className="text-lime">.</span>
            </h2>
            <p className="max-w-[46ch] text-muted">
              Ask anything between sets or on the way to the gym. It answers with your plan in mind, not
              generic advice.
            </p>
          </div>
          <ul className="space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-md border border-line-strong bg-surface-2 text-lime">
                  {p.icon}
                </span>
                <div>
                  <h3 className="font-display font-semibold text-ink">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink href="/signup" size="lg" arrow>
              Meet your coach
            </ButtonLink>
            <p className="text-xs text-subtle">General fitness guidance, not medical advice.</p>
          </div>
        </div>
        <div className="lg:col-span-6">
          <ChatPreview />
        </div>
      </div>
    </section>
  );
}
