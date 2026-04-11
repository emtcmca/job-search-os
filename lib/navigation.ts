import type { Route } from "next";

export type AppRoute = {
  href: Route;
  label: string;
  description: string;
};

export const primaryRoutes: AppRoute[] = [
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
    description: "Separate proposal pipeline for Upwork and Fiverr.",
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
];
