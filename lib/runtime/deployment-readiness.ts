import { getGmailSetupStatus } from "@/lib/inbox/gmail";
import {
  getHostedDatabaseTargetStatus,
  getRuntimeEnvironmentSummary,
} from "@/lib/runtime/deployment";

type ReadinessLevel = "ready" | "attention" | "blocked" | "info";

export type DeploymentReadinessItem = {
  key: string;
  label: string;
  level: ReadinessLevel;
  message: string;
};

export function getDeploymentReadinessReport() {
  const runtime = getRuntimeEnvironmentSummary();
  const hostedTarget = getHostedDatabaseTargetStatus();
  const gmailSetup = getGmailSetupStatus();
  const generatedAt = new Date().toISOString();
  const hostedReadRuntimeReady =
    runtime.database.kind === "libsql_hosted" || (!runtime.isHosted && hostedTarget.ready);

  const items: DeploymentReadinessItem[] = [
    {
      key: "runtime",
      label: "Runtime posture",
      level: runtime.isHosted ? "attention" : "info",
      message: runtime.isHosted
        ? "This process is running in a hosted environment. Browser-backed collectors remain intentionally local-only."
        : "This process is running locally. It can keep using the desktop SQLite database and local browser profile flows.",
    },
    {
      key: "app_url",
      label: "APP_URL",
      level: runtime.isHosted
        ? runtime.hasExplicitAppUrl
          ? "ready"
          : "blocked"
        : "ready",
      message: runtime.appBaseUrlMessage,
    },
    {
      key: "hosted_target",
      label: "Hosted database target",
      level: hostedTarget.ready
        ? "ready"
        : hostedTarget.configured
          ? "attention"
          : "blocked",
      message: hostedTarget.message,
    },
    {
      key: "hosted_runtime",
      label: "Hosted app runtime",
      level: hostedReadRuntimeReady
        ? "ready"
        : runtime.isHosted && runtime.database.kind === "sqlite_file"
          ? "attention"
          : "blocked",
      message: runtime.database.kind === "libsql_hosted"
        ? "This hosted runtime is already reading from durable LibSQL/Turso storage. Hosted write actions remain disabled until the remaining mutation flows finish migrating."
        : hostedTarget.ready
          ? "The deployed Vercel runtime is now configured to read from durable LibSQL/Turso storage. The remaining deployment slice is migrating hosted write actions off the local SQLite call shape."
        : runtime.isHosted && runtime.database.kind === "sqlite_file"
          ? "The hosted preview can run on ephemeral /tmp SQLite storage, but it is still not durable. Treat it as UI testing only until the live runtime switches to hosted persistence."
          : "The live app still runs on local SQLite. After the hosted database is migrated and synced, the next slice is switching the runtime itself over to hosted persistence.",
    },
    {
      key: "gmail_env",
      label: "Gmail OAuth env",
      level: gmailSetup.configured ? "ready" : "blocked",
      message: gmailSetup.configured
        ? "Google OAuth credentials are configured."
        : `Missing ${gmailSetup.missingVars.join(", ")}.`,
    },
    {
      key: "gmail_hosted",
      label: "Hosted Gmail readiness",
      level:
        hostedTarget.ready && gmailSetup.configured && runtime.hasExplicitAppUrl
          ? "attention"
          : "blocked",
      message:
        hostedTarget.ready && gmailSetup.configured && runtime.hasExplicitAppUrl
          ? "The prerequisites are in place to move Gmail toward hosted use after the runtime database refactor."
          : "Hosted Gmail is not ready until the hosted database target, APP_URL, and Google OAuth credentials are all configured.",
    },
    {
      key: "browser_sources",
      label: "Browser-backed sources",
      level: "info",
      message:
        "Google Jobs, LinkedIn, Indeed, Upwork, and Fiverr stay local-only by design. A Vercel deploy should keep using Greenhouse, Lever, Workday, and direct URLs.",
    },
  ];

  const readyCount = items.filter((item) => item.level === "ready").length;
  const blockedCount = items.filter((item) => item.level === "blocked").length;
  const nextSteps: string[] = [];

  if (!hostedTarget.ready) {
    nextSteps.push("Configure HOSTED_DATABASE_URL and HOSTED_DATABASE_AUTH_TOKEN.");
    nextSteps.push("Run npm run db:migrate:hosted.");
    nextSteps.push("Run npm run db:push:hosted.");
  } else {
    nextSteps.push("Redeploy or refresh the Vercel project so the hosted runtime picks up the Turso configuration.");
    nextSteps.push(
      "Continue migrating hosted write actions off the local SQLite call shape so durable mutations can be enabled.",
    );
  }

  if (!runtime.hasExplicitAppUrl) {
    nextSteps.push("Set APP_URL to the deployed site URL before hosted OAuth callbacks.");
  }

  if (!gmailSetup.configured) {
    nextSteps.push("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for hosted Gmail.");
  }

  nextSteps.push(
    "Keep browser-backed collectors local-only on hosted runtimes, even after durable hosted reads are enabled.",
  );

  return {
    generatedAt,
    runtime,
    hostedTarget,
    gmailSetup,
    items,
    summary: {
      readyCount,
      blockedCount,
      overall:
        blockedCount === 0
          ? "ready"
          : hostedTarget.ready
            ? "partial"
            : "not_ready",
    },
    nextSteps,
  };
}
