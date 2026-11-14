import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";
import { SignOutButton } from "@/components/auth/sign-in";
import { IconUser } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <div className="space-y-6">
      <ComingNext
        title="Profile"
        icon={<IconUser />}
        description="Your training profile, units (ft/in, lb) and Pro status land here next."
      />
      <div className="mx-auto max-w-xl px-4">
        <SignOutButton className="w-full" />
      </div>
    </div>
  );
}
