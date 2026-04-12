import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  calculateActualCost,
  estimateTier1Cost,
  tier1Model,
} from "@/lib/ai/config";
import {
  getDraftPacketForJob,
  inferJobStageFromPacket,
} from "@/lib/applications/draft-packet";
import {
  getApplicationReadiness,
  inferApplicationWorkflowStatus,
} from "@/lib/applications/readiness";
import { getJobDetail, listCandidateProfiles } from "@/lib/jobs/queries";
import {
  createGeneratedDocuments,
  getNextGeneratedDocumentVersion,
  getTailoringApplication,
  getTailoringBudgetContext,
  logTailoringApplicationEvent,
  logTailoringUsageEvent,
  updateTailoringApplication,
  updateTailoringJobStage,
} from "@/lib/tailoring/store";

const TailoringSchema = z.object({
  recommendedProfileType: z.string(),
  rationale: z.string(),
  tailoredSummary: z.string(),
  highlightBullets: z.array(z.string()).min(3).max(6),
  coverLetter: z.string(),
  followUpQuestions: z.array(z.string()).max(4),
});

type TailoringPayload = z.infer<typeof TailoringSchema>;

function sanitizeSegment(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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

  const detail = await getJobDetail(jobId);
  if (!detail) {
    return { ok: false as const, message: "Job not found." };
  }

  const profiles = await listCandidateProfiles();
  const suggestedType = detail.score?.recommendedResumeType;
  const profile =
    profiles.find((item) => item.id === requestedProfileId) ??
    profiles.find((item) => item.profileType === suggestedType) ??
    profiles.find((item) => item.isCanonical) ??
    profiles[0];

  if (!profile) {
    return { ok: false as const, message: "No candidate profile is available yet." };
  }

  const { settings, currentSpend } = getTailoringBudgetContext();

  if (!settings) {
    return { ok: false as const, message: "AI budget settings are not initialized." };
  }

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

  const strategyVersion = getNextGeneratedDocumentVersion(jobId, "resume_strategy");
  const letterVersion = getNextGeneratedDocumentVersion(jobId, "cover_letter");
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

  createGeneratedDocuments([
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
  ]);

  const application = getTailoringApplication(jobId);
  const packet = await getDraftPacketForJob(jobId, application);

  if (application) {
    const readiness = getApplicationReadiness(application, packet);
    const nextStatus = inferApplicationWorkflowStatus({
      currentStatus: application.status,
      readiness,
    });

    updateTailoringApplication(application.id, {
      resumeDocId: packet.preferredResumeStrategy?.id ?? application.resumeDocId,
      coverLetterDocId: packet.preferredCoverLetter?.id ?? application.coverLetterDocId,
      status: nextStatus,
    });

    logTailoringApplicationEvent({
      applicationId: application.id,
      payload: {
        resumeDocId: packet.preferredResumeStrategy?.id ?? null,
        coverLetterDocId: packet.preferredCoverLetter?.id ?? null,
        missingDocuments: packet.missingDocuments,
        missingReadyItems: readiness.missingReadyItems,
      },
    });

    updateTailoringJobStage(jobId, {
      currentStage: inferJobStageFromPacket({
        currentStage: detail.job.currentStage,
        applicationStatus: nextStatus,
        packet,
      }),
      updatedAt: new Date().toISOString(),
    });
  } else {
    updateTailoringJobStage(jobId, {
      currentStage: inferJobStageFromPacket({
        currentStage: detail.job.currentStage,
        packet,
      }),
      updatedAt: new Date().toISOString(),
    });
  }

  logTailoringUsageEvent({
    jobId,
    snapshotHash: detail.snapshot?.snapshotHash ?? null,
    tier: "tailoring",
    model: tier1Model,
    estimatedCost: estimate.estimatedCost,
    actualCost,
    wasUserApproved: true,
    cacheHit: false,
  });

  return {
    ok: true as const,
    message: `Tailoring drafts generated with ${tier1Model}. Estimated cost was about $${estimate.estimatedCost.toFixed(
      4,
    )}, actual logged cost is $${actualCost.toFixed(4)}.${
      application
        ? " The existing application record was updated to use the latest draft packet."
        : ""
    }`,
    profileId: profile.id,
    strategyPath,
    coverLetterPath,
  };
}
