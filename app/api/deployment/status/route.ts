import { NextResponse } from "next/server";

import { getDeploymentReadinessReport } from "@/lib/runtime/deployment-readiness";
import { getHostedPreviewMutationStatus } from "@/lib/runtime/deployment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const report = getDeploymentReadinessReport();
  const mutationStatus = getHostedPreviewMutationStatus();

  return NextResponse.json(
    {
      generatedAt: report.generatedAt,
      summary: report.summary,
      runtime: {
        isHosted: report.runtime.isHosted,
        runtimeLabel: report.runtime.runtimeLabel,
        hasExplicitAppUrl: report.runtime.hasExplicitAppUrl,
        browserAutomationAvailable: report.runtime.browserAutomationAvailable,
        browserAutomationMessage: report.runtime.browserAutomationMessage,
        writesAllowed: mutationStatus.writesAllowed,
        writeMessage: mutationStatus.message,
        database: {
          kind: report.runtime.database.kind,
          hostedReady: report.runtime.database.hostedReady,
          ephemeral: report.runtime.database.ephemeral,
          label: report.runtime.database.label,
          message: report.runtime.database.message,
        },
      },
      hostedTarget: {
        configured: report.hostedTarget.configured,
        supported: report.hostedTarget.supported,
        authTokenConfigured: report.hostedTarget.authTokenConfigured,
        ready: report.hostedTarget.ready,
        message: report.hostedTarget.message,
      },
      checks: report.items,
      nextSteps: report.nextSteps,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
