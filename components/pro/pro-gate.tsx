import type { ReactNode } from "react";
import { formatUsd } from "@/lib/client/checkout";
import { PRO_PRICE_USD } from "@/lib/client/economy";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconLock } from "@/components/ui/icons";

/** Locked-feature panel for Free users (SPEC §7 "Free and Pro"). */
export function ProGate({ feature, description, preview }: { feature: string; description: string; preview?: ReactNode }) {
  return (
    <Card tone="feature" className="grain overflow-hidden">
      <div className="grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-md bg-lime text-lime-ink">
              <IconLock size={20} />
            </span>
            <Badge tone="solid">PRO</Badge>
          </div>
          <h2 className="font-display text-title font-bold text-ink">{feature} is part of Pro.</h2>
          <p className="max-w-[44ch] text-muted">{description}</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/pro" size="lg" arrow>
              Go Pro · {formatUsd(PRO_PRICE_USD)}/mo
            </ButtonLink>
            <ButtonLink href="/rewards" variant="secondary" size="lg">
              Earn it with coins
            </ButtonLink>
          </div>
        </div>
        {preview && (
          <div aria-hidden="true" className="pointer-events-none select-none opacity-60 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]">
            {preview}
          </div>
        )}
      </div>
    </Card>
  );
}
