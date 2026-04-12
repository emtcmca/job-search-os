"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";

import { primaryRoutes } from "@/lib/navigation";

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-80">
          <div className="sticky top-6 overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                Job Search OS
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                Personal search, review, and follow-through.
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Local-first workflow for ingestion, ranking, tailored drafts,
                application tracking, and guarded AI usage.
              </p>
            </div>

            <nav className="space-y-2">
              {primaryRoutes.map((route) => {
                const isActive =
                  route.href === "/"
                    ? pathname === route.href
                    : pathname.startsWith(route.href);

                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={`block rounded-2xl border px-4 py-3 transition ${
                      isActive
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-transparent bg-white/50 hover:border-[var(--border)] hover:bg-white/80"
                    }`}
                  >
                    <div className="font-medium">{route.label}</div>
                    <div className="mt-1 text-sm leading-5 text-[var(--muted)]">
                      {route.description}
                    </div>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                AI Safeguards
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
                <li>Tier 0 parsing and rules first.</li>
                <li>Tier 1 kept lean and cached.</li>
                <li>Tier 2 deep analysis requires approval.</li>
              </ul>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

