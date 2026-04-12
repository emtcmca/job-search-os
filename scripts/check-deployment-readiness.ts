import "./load-env";

import { getDeploymentReadinessReport } from "@/lib/runtime/deployment-readiness";

const report = getDeploymentReadinessReport();

console.log(
  JSON.stringify(
    {
      runtime: report.runtime.runtimeLabel,
      overall: report.summary.overall,
      readyCount: report.summary.readyCount,
      blockedCount: report.summary.blockedCount,
      items: report.items,
      nextSteps: report.nextSteps,
    },
    null,
    2,
  ),
);
