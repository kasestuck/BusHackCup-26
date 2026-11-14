import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state";

/**
 * Honest placeholder for screens scheduled in a later build phase, so every
 * dashboard link lands somewhere real instead of a 404.
 */
export function ComingNext({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-10 sm:px-6 sm:pt-16 lg:px-8">
      <Card className="mx-auto max-w-xl">
        <EmptyState
          icon={icon}
          title={`${title} is in the next build phase`}
          description={description}
          action={
            <ButtonLink href="/dashboard" variant="secondary">
              Back to dashboard
            </ButtonLink>
          }
        />
      </Card>
    </div>
  );
}
