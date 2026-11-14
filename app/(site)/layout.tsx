import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "ShowUp — AI Fitness + Gym Rewards", template: "%s · ShowUp" },
  description: "You pay for the gym. We make sure you actually go.",
};

export const viewport: Viewport = {
  themeColor: "#101417",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Root layout for all pages. `app/api/**` (backend) needs no layout. */
export default function SiteRootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions (dark mode, translators, password managers) often add classes to <html>
    // before React loads; this silences that one-element attribute mismatch only.
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
