import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";
import { IconUser } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <ComingNext
      title="Profile"
      icon={<IconUser />}
      description="Your training profile, units (ft/in, lb) and Pro status land here next."
    />
  );
}
