import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { RuntimeBanner } from "@/components/layout/runtime-banner";

export const metadata: Metadata = {
  title: "Job Search OS",
  description:
    "Local-first job search workspace for ingestion, scoring, tailoring, and follow-through.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="space-y-4 px-4 pt-4 sm:px-6 lg:px-10">
          <RuntimeBanner />
        </div>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
