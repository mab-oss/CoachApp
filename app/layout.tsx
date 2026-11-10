import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CoachApp — Workout Tracker + AI Coach",
    template: "%s · CoachApp",
  },
  description:
    "Log your workouts, see real progress trends, and get evidence-based training adjustments from a built-in AI coach.",
  applicationName: "CoachApp",
  openGraph: {
    title: "CoachApp — Workout Tracker + AI Coach",
    description:
      "Log workouts, track progress, and let an AI agent suggest what to change next.",
    siteName: "CoachApp",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#070a0f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
