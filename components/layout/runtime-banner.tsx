import Link from "next/link";

import { getDeploymentReadinessReport } from "@/lib/runtime/deployment-readiness";
import { getHostedPreviewMutationStatus } from "@/lib/runtime/deployment";

export function RuntimeBanner() {
  const report = getDeploymentReadinessReport();
  const mutationStatus = getHostedPreviewMutationStatus();

  if (!report.runtime.isHosted || mutationStatus.writesAllowed) {
    return null;
  }

  const durableHostedReadOnly = report.runtime.database.kind === "libsql_hosted";

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="rounded-[24px] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950 shadow-[var(--shadow)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="font-semibold">
              {durableHostedReadOnly
                ? "Hosted runtime is using durable storage in read-only mode."
                : "Hosted preview is running on ephemeral storage in read-only mode."}
            </div>
            <div className="mt-1 leading-6">
              {durableHostedReadOnly
                ? "This deployment now reads from durable LibSQL/Turso storage, but mutating actions stay disabled until the remaining write flows finish migrating off the local SQLite call shape."
                : "This deployment is using `/tmp` SQLite so the app can boot for UI testing, but data is not durable and can reset between deploys or cold starts. Mutating actions stay disabled here so the preview does not pretend it has durable state."}
            </div>
            <div className="mt-2 text-xs uppercase tracking-[0.18em] text-amber-900/80">
              {mutationStatus.message}
            </div>
          </div>
          <Link
            href="/settings/deployment"
            className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-950"
          >
            Open deployment checklist
          </Link>
        </div>
      </div>
    </div>
  );
}
