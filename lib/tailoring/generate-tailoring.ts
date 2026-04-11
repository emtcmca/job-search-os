import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import {
  calculateActualCost,
  estimateTier1Cost,
  tier1Model,
} from "@/lib/ai/config";
import { db } from "@/lib/db/client";
import { aiBudgetSettings, aiUsageEvents } from "@/lib/db/schema/integrations";
import { generatedDocuments } from "@/lib/db/schema/profiles";
import { getJobDetail, listCandidateProfiles } from "@/lib/jobs/queries";

const TailoringSchema = z.object({
  recommendedProfileType: z.string(),
  rationale: z.string(),
  tailoredSummary: z.string(),
  highlightBullets: z.array(z.string()).min(3).max(6),
  coverLetter: z.string(),
  followUpQuestions: z.array(z.string()).max(4),
});

type TailoringPayload = z.infer<typeof TailoringSchema>;

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function sanitizeSegment(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function nextVersionFor(jobId: number, documentType: string) {
  const latest = db
    .select()
    .from(generatedDocuments)
    .where(
      sql`${generatedDocuments.jobId} = ${jobId} and ${generatedDocuments.documentType} = ${documentType}`,
    )
    .orderBy(desc(generatedDocuments.version))
    .get();

  return (latest?.version ?? 0) + 1;
}

function buildResumeStrategyMarkdown(payload: TailoringPayload, profileName: string) {
  return [
    `# Resume Strategy`,
    ``,
    `Selected profile: ${profileName}`,
    `Recommended lane: ${payload.recommendedProfileType}`,
    ``,
    `## Rationale`,
    payload.rationale,
    ``,
    `## Tailored Summary`,
    payload.tailoredSummary,
    ``,
    `## Highlight Bullets`,
    ...payload.highlightBullets.map((bullet) => `- ${bullet}`),
    ``,
    `## Questions Before Finalizing`,
    ...(payload.followUpQuestions.length > 0
      ? payload.followUpQuestions.map((question) => `- ${question}`)
      : ["- None right now."]),
    ``,
  ].join("\n");
}

function buildCoverLetterMarkdown(payload: TailoringPayload) {
  return [`# Cover Letter Draft`, ``, payload.coverLetter.trim(), ``].join("\n");
}

export async function generateTailoringDraft(jobId: number, requestedProfileId?: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false as const,
      message: "OPENAI_API_KEY is not configured in the local environment for this repo yet.",
    };
  }

  const detail = getJobDetail(jobId);
  if (!detail) {
    return { ok: false as const, message: "Job not found." };
  }

  const profiles = listCandidateProfiles();
  const suggestedType = detail.score?.recommendedResumeType;
  const profile =
    profiles.find((item) => item.id === requestedProfileId) ??
    profiles.find((item) => item.profileType === suggestedType) ??
    profiles.find((item) => item.isCanonical) ??
    profiles[0];

  if (!profile) {
    return { ok: false as const, message: "No candidate profile is available yet." };
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

  const profileContent = JSON.parse(profile.contentJson) as {
    headline: string;
    summary: string;
    targetTitles: string[];
    strengths: string[];
  };

  const prompt = [
    "Create a conservative application draft packet for this job.",
    "Never invent skills, roles, dates, or achievements. Only reframe and emphasize what is already supported by the candidate profile.",
    "Return structured output only.",
    `Candidate profile name: ${profile.name}`,
    `Candidate profile type: ${profile.profileType}`,
    `Candidate headline: ${profileContent.headline}`,
    `Candidate summary: ${profileContent.summary}`,
    `Target titles: ${profileContent.targetTitles.join(", ")}`,
    `Strengths: ${profileContent.strengths.join(", ")}`,
    `Job title: ${detail.job.title}`,
    `Company: ${detail.company?.name ?? "Unknown"}`,
    `Location: ${detail.job.locationText ?? "Unknown"} ${detail.job.locationType ? `(${detail.job.locationType})` : ""}`,
    `Current fit recommendation: ${detail.score?.recommendation ?? "review"}`,
    `Job text: ${(detail.snapshot?.rawText ?? "").slice(0, 9000) || "No snapshot text available."}`,
    "Provide a tailored summary, 3 to 6 resume highlight bullets, a concise cover letter, and any questions that must be answered before final submission.",
  ].join("\n\n");

  const estimate = estimateTier1Cost(prompt, 1400);
  const currentSpend = monthlySpendRow?.spent ?? 0;

  if (settings.hardLimitEnabled && currentSpend + estimate.estimatedCost > settings.monthlyBudget) {
    return {
      ok: false as const,
      message: "Tailoring is blocked because it would exceed the current monthly AI budget.",
    };
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model: tier1Model,
    input: [
      {
        role: "developer",
        content:
          "Draft job-application materials conservatively. Preserve factual accuracy and avoid embellishment.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_output_tokens: 1400,
    text: {
      format: zodTextFormat(TailoringSchema, "tailoring_draft"),
    },
  });

  const payload = response.output_parsed as TailoringPayload | null;
  if (!payload) {
    return {
      ok: false as const,
      message: "Tailoring did not return a structured result.",
    };
  }

  const usage = response.usage;
  const inputTokens = usage?.input_tokens ?? estimate.inputTokens;
  const outputTokens = usage?.output_tokens ?? estimate.outputTokens;
  const actualCost = calculateActualCost(inputTokens, outputTokens);

  const folder = resolve(process.cwd(), "output", "generated", `job-${jobId}`);
  mkdirSync(folder, { recursive: true });

  const strategyVersion = nextVersionFor(jobId, "resume_strategy");
  const letterVersion = nextVersionFor(jobId, "cover_letter");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const companySlug = sanitizeSegment(detail.company?.name ?? "company");

  const strategyPath = resolve(
    folder,
    `${timestamp}-${companySlug}-resume-strategy-v${strategyVersion}.md`,
  );
  const coverLetterPath = resolve(
    folder,
    `${timestamp}-${companySlug}-cover-letter-v${letterVersion}.md`,
  );

  const strategyMarkdown = buildResumeStrategyMarkdown(payload, profile.name);
  const coverLetterMarkdown = buildCoverLetterMarkdown(payload);

  writeFileSync(strategyPath, strategyMarkdown, "utf8");
  writeFileSync(coverLetterPath, coverLetterMarkdown, "utf8");

  db.insert(generatedDocuments)
    .values([
      {
        jobId,
        documentType: "resume_strategy",
        profileId: profile.id,
        version: strategyVersion,
        filePath: strategyPath,
        contentText: strategyMarkdown,
        provenanceJson: JSON.stringify({
          profileId: profile.id,
          profileType: profile.profileType,
          rationale: payload.rationale,
          followUpQuestions: payload.followUpQuestions,
        }),
        approvalState: "draft",
      },
      {
        jobId,
        documentType: "cover_letter",
        profileId: profile.id,
        version: letterVersion,
        filePath: coverLetterPath,
        contentText: coverLetterMarkdown,
        provenanceJson: JSON.stringify({
          profileId: profile.id,
          profileType: profile.profileType,
        }),
        approvalState: "draft",
      },
    ])
    .run();

  db.insert(aiUsageEvents)
    .values({
      jobId,
      snapshotHash: detail.snapshot?.snapshotHash ?? null,
      tier: "tailoring",
      model: tier1Model,
      estimatedCost: estimate.estimatedCost,
      actualCost,
      wasUserApproved: true,
      cacheHit: false,
    })
    .run();

  return {
    ok: true as const,
    message: `Tailoring drafts generated with ${tier1Model}. Estimated cost was about $${estimate.estimatedCost.toFixed(
      4,
    )}, actual logged cost is $${actualCost.toFixed(4)}.`,
    profileId: profile.id,
    strategyPath,
    coverLetterPath,
  };
}
