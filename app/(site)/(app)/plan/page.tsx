import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";
import { IconCalendar } from "@/components/ui/icons";

export const metadata: Metadata = { title: "My Plan" };

export default function Page() {
  return (
    <ComingNext
      title="My Plan"
      icon={<IconCalendar />}
      description="Week calendar, exercise cards with technique videos and the workout log land here next. Your schedule is already on the dashboard."
    />
  );
}
