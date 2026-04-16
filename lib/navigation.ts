import type { Route } from "next";

export type AppRoute = {
  href: Route;
  label: string;
  description: string;
  badgeValue?: string;
};

export function getPrimaryRoutes(options?: { inboxAttentionCount?: number }): AppRoute[] {
  const inboxAttentionCount = options?.inboxAttentionCount ?? 0;

  return [
    {
      href: "/",
      label: "Dashboard",
      description: "Digest, budget, and top-priority review queues.",
    },
    {
      href: "/jobs",
      label: "Jobs",
      description: "Full-time opportunities, scoring, and triage.",
    },
    {
      href: "/freelance",
      label: "Freelance",
      description: "Leads, niches, proposals, and service listings.",
    },
    {
      href: "/searches",
      label: "Searches",
      description: "Saved searches and ingestion scheduling.",
    },
    {
      href: "/applications",
      label: "Applications",
      description: "Tracker, reminders, and current action items.",
    },
    {
      href: "/candidate-profile",
      label: "Profile",
      description: "Canonical candidate data and role variants.",
    },
    {
      href: "/linear",
      label: "Linear",
      description: "Vault structure, sync rules, and issue templates.",
    },
    {
      href: "/settings/ai",
      label: "AI Controls",
      description: "Budget caps, approval gates, and deep-review policy.",
    },
    {
      href: "/settings/inbox" as Route,
      label: "Inbox",
      description: "Employer replies, intake rules, and future email access.",
      badgeValue: inboxAttentionCount > 0 ? String(inboxAttentionCount) : undefined,
    },
    {
      href: "/settings/deployment" as Route,
      label: "Deployment",
      description: "Hosted rollout checklist, database prep, and deployment posture.",
    },
  ];
}

export const primaryRoutes: AppRoute[] = getPrimaryRoutes();
