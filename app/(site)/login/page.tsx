import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";
import { IconLock } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <ComingNext
      title="Sign in"
      icon={<IconLock />}
      description="Email and password or magic-link sign-in lands here next, together with Supabase auth from the backend."
    />
  );
}
