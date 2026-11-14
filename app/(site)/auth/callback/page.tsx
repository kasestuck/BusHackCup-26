import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCallback } from "@/components/auth/auth-callback";

export const metadata: Metadata = { title: "Signing in", robots: { index: false, follow: false } };

export default function AuthCallbackPage() {
  return (
    <AuthLayout>
      <Suspense>
        <AuthCallback />
      </Suspense>
    </AuthLayout>
  );
}
