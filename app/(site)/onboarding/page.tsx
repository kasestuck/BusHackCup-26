import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";
import { IconSpark } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Onboarding" };

export default function Page() {
  return (
    <ComingNext
      title="Onboarding"
      icon={<IconSpark />}
      description="The step-by-step questionnaire (height, weight, injuries, goal, workout type, time, weekdays) lands here next."
    />
  );
}
