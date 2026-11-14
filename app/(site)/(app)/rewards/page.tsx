import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";
import { IconGift } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Rewards" };

export default function Page() {
  return (
    <ComingNext
      title="Rewards"
      icon={<IconGift />}
      description="The coin marketplace (Pro month and partner promo codes) lands here next. Your balance and closest reward are on the dashboard."
    />
  );
}
