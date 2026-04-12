import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { calculateActualCost, estimateTier1Cost, tier1Model } from "@/lib/ai/config";
import { db } from "@/lib/db/client";
import { aiBudgetSettings, aiUsageEvents } from "@/lib/db/schema/integrations";
import { scoreFactors, scores } from "@/lib/db/schema/scoring";
import { getJobDetail } from "@/lib/jobs/queries";

const Tier1PayloadSchema = z.object({
  overallScore: z.number().min(0).max(100),
  recommendation: z.enum(["skip", "review", "tailor", "deep_review_recommended"]),
  summary: z.string(),
  reasonsFor: z.array(z.string()),
  reasonsAgainst: z.array(z.string()),
  recommendedResumeType: z.string(),
  deepReviewRecommended: z.boolean(),
  deepReviewReason: z.string().nullable(),
});

type Tier1Payload = z.infer<typeof Tier1PayloadSchema>;

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function runTier1Analysis(jobId: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false as const,
      message:
        "OPENAI_API_KEY is not configured in the local environment for this repo yet.",
    };
  }

  const detail = await getJobDetail(jobId);
  if (!detail) {
    return { ok: false as const, message: "Job not found." };
  }

  const settings = db
    .select()
    .from(aiBudgetSettings)
    .where(eq(aiBudgetSettings.id, 1))
    .get();

  if (!settings) {
    return { ok: false as const, message: "AI budget settings are not initialized." };
  }

  const monthlySpendRow = db
    .select({
      spent: sql<number>`coalesce(sum(${aiUsageEvents.actualCost}), 0)`,
    })
    .from(aiUsageEvents)
    .where(gte(aiUsageEvents.createdAt, monthStartIso()))
    .get();

  const currentMonthlySpend = monthlySpendRow?.spent ?? 0;

  const snapshotText = (detail.snapshot?.rawText ?? "").slice(0, 8000);
  const prompt = [
    "You are evaluating a job posting for a candidate with a strong background in operations leadership, workflow design, process improvement, systems implementation, service delivery, and AI-enabled workflow automation.",
    "Return JSON only with these keys:",
    'overallScore (number 0-100), recommendation ("skip" | "review" | "tailor" | "deep_review_recommended"), summary (string), reasonsFor (string[]), reasonsAgainst (string[]), recommendedResumeType (string), deepReviewRecommended (boolean), deepReviewReason (string or null).',
    "Do not invent candidate experience. Prefer concise reasons grounded in the job text.",
    `Job title: ${detail.job.title}`,
    `Company: ${detail.company?.name ?? "Unknown"}`,
    `Location: ${detail.job.locationText ?? "Unknown"} ${detail.job.locationType ? `(${detail.job.locationType})` : ""}`,
    `Employment type: ${detail.job.employmentType ?? "Unknown"}`,
    `Current Tier 0 recommendation: ${detail.score?.recommendation ?? "review"}`,
    `Current Tier 0 summary: ${detail.score?.summary ?? "None"}`,
    `Job text: ${snapshotText || "No snapshot text available."}`,
  ].join("\n\n");

  const estimate = estimateTier1Cost(prompt, 700);
  const projectedSpend = currentMonthlySpend + estimate.estimatedCost;

  if (settings.hardLimitEnabled && projectedSpend > settings.monthlyBudget) {
    return {
      ok: false as const,
      message:
        "Tier 1 analysis is blocked because it would exceed the current monthly AI budget.",
    };
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model: tier1Model,
    input: [
      {
        role: "developer",
        content:
          "Evaluate job fit conservatively. Do not invent candidate qualifications. Return concise structured output only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_output_tokens: 700,
    text: {
      format: zodTextFormat(Tier1PayloadSchema, "tier1_job_analysis"),
    },
  });

  const payload = response.output_parsed as Tier1Payload | null;
  if (!payload) {
    return {
      ok: false as const,
      message: "Tier 1 analysis did not return a structured result.",
    };
  }

  const usage = response.usage;
  const inputTokens = usage?.input_tokens ?? estimate.inputTokens;
  const outputTokens = usage?.output_tokens ?? estimate.outputTokens;
  const actualCost = calculateActualCost(inputTokens, outputTokens);

  const scoreId = db
    .insert(scores)
    .values({
      jobId,
      snapshotId: detail.snapshot?.id ?? null,
      tier: "tier_1",
      overallScore: payload.overallScore,
      recommendation: payload.recommendation,
      recommendedResumeType: payload.recommendedResumeType,
      deepReviewRecommended: payload.deepReviewRecommended,
      deepReviewReason: payload.deepReviewReason,
      summary: payload.summary,
      reasonsForJson: JSON.stringify(payload.reasonsFor),
      reasonsAgainstJson: JSON.stringify(payload.reasonsAgainst),
    })
    .returning({ id: scores.id })
    .get()?.id;

  if (scoreId) {
    db.insert(scoreFactors)
      .values([
        ...payload.reasonsFor.map((reason, index) => ({
          scoreId,
          factorKey: `tier1_positive_${index + 1}`,
          factorLabel: "Tier 1 positive signal",
          weight: 1,
          value: 1,
          explanation: reason,
        })),
        ...payload.reasonsAgainst.map((reason, index) => ({
          scoreId,
          factorKey: `tier1_risk_${index + 1}`,
          factorLabel: "Tier 1 risk signal",
          weight: -1,
          value: -1,
          explanation: reason,
        })),
      ])
      .run();
  }

  db.insert(aiUsageEvents)
    .values({
      jobId,
      snapshotHash: detail.snapshot?.snapshotHash ?? null,
      tier: "tier_1",
      model: tier1Model,
      estimatedCost: estimate.estimatedCost,
      actualCost,
      wasUserApproved: true,
      cacheHit: false,
    })
    .run();

  return {
    ok: true as const,
    message: `Tier 1 analysis completed using ${tier1Model}. Estimated cost was about $${estimate.estimatedCost.toFixed(
      4,
    )}, actual logged cost is $${actualCost.toFixed(4)}.`,
  };
}
