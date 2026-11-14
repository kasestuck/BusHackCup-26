import { redirect } from "next/navigation";

// Pure redirect, nothing to validate for instant navigation.
export const instant = false;

// The landing page is a later phase; until then `/` opens the dashboard.
export default function Home() {
  redirect("/dashboard");
}
