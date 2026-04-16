import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { calculateActualCost, estimateTier1Cost } from "@/lib/ai/config";
import { db } from "@/lib/db/client";
import { aiBudgetSettings, aiUsageEvents } from "@/lib/db/schema/integrations";
import { getPlatformKnowledge } from "@/lib/freelance/platforms";

export const FreelanceNicheSchema = z.object({
  id: z.string(),
  title: z.string(),
  demand: z.enum(["High", "Medium", "Niche"]),
  rationale: z.string(),
  platforms: z.array(z.string()),
  buyer: z.string(),
  edge: z.string(),
});

export const FreelanceNicheDiscoverySchema = z.object({
  niches: z.array(FreelanceNicheSchema).min(1).max(8),
});

export const FreelanceFitSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.enum(["Strong Fit", "Good Fit", "Weak Fit", "Pass"]),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  angle: z.string(),
  pursue: z.boolean(),
});

export const FreelanceProposalSchema = z.object({
  fit: FreelanceFitSchema,
  proposal: z.string(),
});

const PackageSchema = z.object({
  name: z.string(),
  description: z.string(),
  deliveryDays: z.number(),
  revisions: z.number(),
  price: z.string(),
});

const UpworkListingSchema = z.object({
  catalogTitle: z.string(),
  category: z.string(),
  searchTags: z.array(z.string()).max(5),
  descriptionHook: z.string(),
  fullDescription: z.string(),
  tiers: z.object({
    starter: PackageSchema,
    standard: PackageSchema,
    advanced: PackageSchema,
  }),
  addOns: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      price: z.string(),
      deliveryDays: z.number(),
    }),
  ),
  clientRequirements: z.array(z.string()),
});

const FiverrListingSchema = z.object({
  gigTitle: z.string(),
  tags: z.array(z.string()).max(5),
  packages: z.object({
    basic: PackageSchema,
    standard: PackageSchema,
    premium: PackageSchema,
  }),
  description: z.string(),
  requirements: z.array(z.string()),
  gigExtras: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      price: z.string(),
      deliveryDays: z.number(),
    }),
  ),
});

const GenericListingSchema = z.object({
  listingTitle: z.string(),
  tagline: z.string(),
  overview: z.string(),
  deliverables: z.array(z.string()),
  idealClient: z.string(),
  notFor: z.string(),
  pricingGuidance: z.string(),
  callToAction: z.string(),
  keywords: z.array(z.string()),
  platformNotes: z.string(),
});

export const FreelanceListingSchema = z.union([
  UpworkListingSchema,
  FiverrListingSchema,
  GenericListingSchema,
]);

type Provider = "openai" | "anthropic";

type StructuredRequest<T extends z.ZodTypeAny> = {
  task: string;
  schemaName: string;
  schema: T;
  developerPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
  jobId?: number | null;
};

type ProfileForPrompt = {
  name: string;
  services: string[];
  pricing: Record<string, unknown>;
  voice: Record<string, unknown>;
  proofPoints: string[];
  bannedClaims: string[];
  platformPreferences: Record<string, unknown>;
  notes?: string | null;
};

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function preferredProvider(): Provider {
  const requested = process.env.FREELANCE_AI_PROVIDER?.trim().toLowerCase();
  if (requested === "anthropic" || requested === "openai") {
    return requested;
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return "anthropic";
  }

  return "openai";
}

function providerModel(provider: Provider) {
  if (provider === "anthropic") {
    return process.env.FREELANCE_ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
  }

  return process.env.FREELANCE_OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

function stripJson(raw: string) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  if (objectStart === -1 || objectEnd === -1) {
    return cleaned;
  }

  return cleaned.slice(objectStart, objectEnd + 1);
}

async function ensureBudgetAllows(prompt: string, outputTokens: number) {
  const settings = await db
    .select()
    .from(aiBudgetSettings)
    .where(eq(aiBudgetSettings.id, 1))
    .get();

  if (!settings) {
    return {
      ok: false as const,
      message: "AI budget settings are not initialized.",
      estimate: estimateTier1Cost(prompt, outputTokens),
    };
  }

  const estimate = estimateTier1Cost(prompt, outputTokens);
  const monthlySpendRow = await db
    .select({
      spent: sql<number>`coalesce(sum(${aiUsageEvents.actualCost}), 0)`,
    })
    .from(aiUsageEvents)
    .where(gte(aiUsageEvents.createdAt, monthStartIso()))
    .get();

  const projected = (monthlySpendRow?.spent ?? 0) + estimate.estimatedCost;
  if (settings.hardLimitEnabled && projected > settings.monthlyBudget) {
    return {
      ok: false as const,
      message:
        "Freelance generation is blocked because it would exceed the current monthly AI budget.",
      estimate,
    };
  }

  return { ok: true as const, estimate };
}

async function logUsage(input: {
  jobId?: number | null;
  task: string;
  provider: Provider;
  model: string;
  estimatedCost: number;
  inputTokens?: number;
  outputTokens?: number;
}) {
  const actualCost =
    typeof input.inputTokens === "number" && typeof input.outputTokens === "number"
      ? calculateActualCost(input.inputTokens, input.outputTokens)
      : input.estimatedCost;

  await db
    .insert(aiUsageEvents)
    .values({
      jobId: input.jobId ?? null,
      tier: `freelance_${input.task}`,
      model: `${input.provider}:${input.model}`,
      estimatedCost: input.estimatedCost,
      actualCost,
      wasUserApproved: true,
      cacheHit: false,
    })
    .run();
}

async function callOpenAiStructured<T extends z.ZodTypeAny>(
  request: StructuredRequest<T>,
  model: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model,
    input: [
      { role: "developer", content: request.developerPrompt },
      { role: "user", content: request.userPrompt },
    ],
    max_output_tokens: request.maxOutputTokens ?? 1200,
    text: {
      format: zodTextFormat(request.schema, request.schemaName),
    },
  });

  const payload = response.output_parsed as z.infer<T> | null;
  if (!payload) {
    throw new Error("The model did not return structured output.");
  }

  await logUsage({
    jobId: request.jobId,
    task: request.task,
    provider: "openai",
    model,
    estimatedCost: estimateTier1Cost(request.userPrompt, request.maxOutputTokens ?? 1200)
      .estimatedCost,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
  });

  return payload;
}

async function callAnthropicStructured<T extends z.ZodTypeAny>(
  request: StructuredRequest<T>,
  model: string,
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxOutputTokens ?? 1200,
      system: request.developerPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  if (!response.ok || data.error) {
    throw new Error(data.error?.message ?? `Anthropic request failed (${response.status}).`);
  }

  const raw = (data.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
  const parsed = request.schema.parse(JSON.parse(stripJson(raw))) as z.infer<T>;

  await logUsage({
    jobId: request.jobId,
    task: request.task,
    provider: "anthropic",
    model,
    estimatedCost: estimateTier1Cost(request.userPrompt, request.maxOutputTokens ?? 1200)
      .estimatedCost,
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  });

  return parsed;
}

async function callStructured<T extends z.ZodTypeAny>(request: StructuredRequest<T>) {
  const provider = preferredProvider();
  const model = providerModel(provider);
  const budget = await ensureBudgetAllows(
    `${request.developerPrompt}\n\n${request.userPrompt}`,
    request.maxOutputTokens ?? 1200,
  );

  if (!budget.ok) {
    throw new Error(budget.message);
  }

  if (provider === "anthropic") {
    return callAnthropicStructured(request, model);
  }

  return callOpenAiStructured(request, model);
}

export function formatProfileForPrompt(profile: ProfileForPrompt) {
  return [
    `Profile: ${profile.name}`,
    `Services: ${profile.services.join("; ")}`,
    `Pricing: ${JSON.stringify(profile.pricing)}`,
    `Voice: ${JSON.stringify(profile.voice)}`,
    `Proof points: ${profile.proofPoints.join("; ")}`,
    `Banned claims: ${profile.bannedClaims.join("; ")}`,
    `Platform preferences: ${JSON.stringify(profile.platformPreferences)}`,
    profile.notes ? `Notes: ${profile.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function discoverFreelanceNiches(profilePrompt: string) {
  return callStructured({
    task: "niche_discovery",
    schemaName: "freelance_niche_discovery",
    schema: FreelanceNicheDiscoverySchema,
    maxOutputTokens: 1300,
    developerPrompt:
      "Identify specific freelance service niches. Return structured JSON only. Be concrete, commercially plausible, and faithful to the profile. Do not invent credentials.",
    userPrompt: [
      profilePrompt,
      "Find exactly 6 specific freelance service niches for Upwork, Toptal, Contra, Fiverr, and Indeed.",
      "Avoid generic labels like operations consulting unless the angle is specific.",
      "Each niche must include a short slug id, title, demand, rationale, platforms, buyer, and Eric's edge.",
    ].join("\n\n"),
  });
}

export async function generateFreelanceProposal(input: {
  profilePrompt: string;
  platform: string;
  listingText: string;
  tone: string;
  jobId?: number | null;
}) {
  const platform = getPlatformKnowledge(input.platform);
  const toneRule =
    input.tone === "concise"
      ? "Keep the proposal under 150 words."
      : input.tone === "detailed"
        ? "Write 250-300 words with a brief plan."
        : "Write 180-220 words with enough specificity to feel tailored.";

  return callStructured({
    task: "proposal",
    schemaName: "freelance_proposal",
    schema: FreelanceProposalSchema,
    maxOutputTokens: 1100,
    jobId: input.jobId,
    developerPrompt:
      "Score freelance gig fit and write proposals as Eric Tetzlaff. Return structured JSON only. No filler openers. Do not invent experience.",
    userPrompt: [
      input.profilePrompt,
      `Platform: ${platform.key}`,
      `Platform rules: ${platform.rules.join(" ")}`,
      `Proposal rules: ${platform.proposalRules.join(" ")}`,
      `Tone/length: ${toneRule}`,
      "Return a fit analysis and the final proposal.",
      `Listing:\n${input.listingText.slice(0, 9000)}`,
    ].join("\n\n"),
  });
}

export async function generateServiceListing(input: {
  profilePrompt: string;
  platform: string;
  niche: {
    title: string;
    buyer?: string | null;
    edge?: string | null;
    rationale?: string | null;
  };
}) {
  const platform = getPlatformKnowledge(input.platform);
  return callStructured({
    task: "service_listing",
    schemaName: "freelance_service_listing",
    schema: FreelanceListingSchema,
    maxOutputTokens: 1500,
    developerPrompt:
      "Create platform-specific freelance service listing copy. Return structured JSON only. Keep claims grounded in the profile.",
    userPrompt: [
      input.profilePrompt,
      `Platform: ${platform.key}`,
      `Platform rules: ${platform.rules.join(" ")}`,
      `Listing rules: ${platform.listingRules.join(" ")}`,
      `Niche: ${input.niche.title}`,
      `Buyer: ${input.niche.buyer ?? "Not specified"}`,
      `Eric's edge: ${input.niche.edge ?? "Not specified"}`,
      `Rationale: ${input.niche.rationale ?? "Not specified"}`,
    ].join("\n\n"),
  });
}
