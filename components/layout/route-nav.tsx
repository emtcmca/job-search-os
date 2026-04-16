"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AppRoute } from "@/lib/navigation";

export function RouteNav({ routes }: { routes: AppRoute[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {routes.map((route) => {
        const isActive =
          route.href === "/" ? pathname === route.href : pathname.startsWith(route.href);

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
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium">{route.label}</div>
              {route.badgeValue ? (
                <div className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white">
                  {route.badgeValue}
                </div>
              ) : null}
            </div>
            <div className="mt-1 text-sm leading-5 text-[var(--muted)]">
              {route.description}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
