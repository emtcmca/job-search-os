import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { importJob } from "@/lib/jobs/import-job";
import { getJobDetail } from "@/lib/jobs/queries";
import { runTier1Analysis } from "@/lib/ai/tier1-analysis";

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadDotEnvLocal();
  await ensureDefaultRecords();

  const imported = await importJob({
    url: "https://example.com/jobs/operations-manager",
    manualTitle: "Operations Manager",
    manualCompany: "Acme Workflow Systems",
    manualLocation: "Remote - United States",
    rawDescription:
      "We are hiring an Operations Manager to lead process improvement, service delivery, workflow redesign, systems implementation, SOP development, vendor coordination, and cross-functional execution. This full-time remote role pays $95,000 - $115,000.",
  });

  if (!imported.ok) {
    console.error(imported.message);
    process.exit(1);
  }

  const result = await runTier1Analysis(imported.jobId);
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }

  const detail = await getJobDetail(imported.jobId);
  console.log(
    JSON.stringify(
      {
        importedJobId: imported.jobId,
        message: result.message,
        latestTier: detail?.score?.tier,
        latestRecommendation: detail?.score?.recommendation,
        latestSummary: detail?.score?.summary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
