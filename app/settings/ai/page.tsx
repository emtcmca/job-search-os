import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { tier1Model } from "@/lib/ai/config";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getAiBudgetSettings, getAiUsageSummary } from "@/lib/jobs/queries";

export default async function AISettingsPage() {
  await ensureDefaultRecords();
  const [budget, usage] = await Promise.all([getAiBudgetSettings(), getAiUsageSummary()]);

  return (
    <PageFrame
      eyebrow="AI Controls"
      title="Keep automation helpful, transparent, and budget-aware."
      description="This view will own budget caps, warning thresholds, model routing, deep-review approval gates, and the recommendation queue for higher-cost analysis."
      metrics={[
        {
          label: "Monthly Budget",
          value: `$${(budget?.monthlyBudget ?? 25).toFixed(2)}`,
          hint: "Initial target budget for lean MVP usage.",
        },
        {
          label: "Deep Review",
          value: "Approval Only",
          hint: "No automatic Tier 2 analysis is allowed.",
        },
        {
          label: "Current Spend",
          value: `$${usage.spent.toFixed(4)}`,
          hint: `${usage.requests} AI requests logged this month.`,
        },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard
          title="Default behavior"
          body="Tier 0 runs by default, Tier 1 stays lightweight, and Tier 2 requires explicit approval with cost preview and cache checks."
        />
        <InfoCard
          title="Safeguards"
          body="Budget meters, warning thresholds, duplicate-spend prevention, and stale-refresh logic will all be visible and enforced here."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard
          title="Tier 1 model"
          body={`The current low-cost analysis path is wired to ${tier1Model}. It is only triggered when you click to run it on a job detail page.`}
        />
        <InfoCard
          title="Current enforcement"
          body={`Hard-limit enforcement is ${budget?.hardLimitEnabled ? "enabled" : "disabled"}, and the default policy to never auto-run deep analysis is ${budget?.neverAutoRunDeepAnalysis ? "enabled" : "disabled"}.`}
        />
      </div>
    </PageFrame>
  );
}
