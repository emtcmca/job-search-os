type ScoreInput = {
  title: string;
  company: string | null;
  locationText: string | null;
  locationType: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  rawText: string;
};

type Tier0Result = {
  overallScore: number;
  recommendation: "skip" | "review" | "tailor" | "deep_review_recommended";
  summary: string;
  reasonsFor: string[];
  reasonsAgainst: string[];
  rejected: boolean;
};

const preferredTitleKeywords = [
  "operations",
  "workflow",
  "process",
  "implementation",
  "consultant",
  "program",
  "service delivery",
  "ai",
  "automation",
];

const strongMatchKeywords = [
  "sop",
  "change management",
  "vendor management",
  "systems implementation",
  "process improvement",
  "knowledge base",
  "cross-functional",
  "operations",
];

const mismatchKeywords = ["senior vice president", "chief executive", "physician"];

export function scoreJobTier0(input: ScoreInput): Tier0Result {
  const haystack = [
    input.title,
    input.company ?? "",
    input.locationText ?? "",
    input.locationType ?? "",
    input.employmentType ?? "",
    input.rawText,
  ]
    .join(" ")
    .toLowerCase();

  const reasonsFor: string[] = [];
  const reasonsAgainst: string[] = [];
  let score = 40;
  let rejected = false;

  const matchedTitleKeywords = preferredTitleKeywords.filter((keyword) =>
    haystack.includes(keyword),
  );
  if (matchedTitleKeywords.length > 0) {
    score += Math.min(24, matchedTitleKeywords.length * 6);
    reasonsFor.push(
      `Role language matches target lanes: ${matchedTitleKeywords.join(", ")}.`,
    );
  }

  const matchedStrongKeywords = strongMatchKeywords.filter((keyword) =>
    haystack.includes(keyword),
  );
  if (matchedStrongKeywords.length > 0) {
    score += Math.min(18, matchedStrongKeywords.length * 3);
    reasonsFor.push(
      `Posting references strengths from your background: ${matchedStrongKeywords.join(", ")}.`,
    );
  }

  const salaryReference = input.salaryMax ?? input.salaryMin;
  if (salaryReference !== null) {
    if (salaryReference < 56000) {
      score -= 35;
      rejected = true;
      reasonsAgainst.push(
        "Compensation appears more than 30% below the current target floor.",
      );
    } else if (salaryReference < 80000) {
      score -= 12;
      reasonsAgainst.push("Compensation appears below the preferred target range.");
    } else {
      score += 10;
      reasonsFor.push("Compensation meets or exceeds the current target floor.");
    }
  } else {
    reasonsAgainst.push("Compensation is not clearly stated yet.");
  }

  if (input.locationType?.toLowerCase().includes("remote")) {
    score += 10;
    reasonsFor.push("Remote-friendly location matches your stated preference.");
  } else if (input.locationType?.toLowerCase().includes("hybrid")) {
    score += 8;
    reasonsFor.push("Hybrid setup matches your stated preference.");
  } else if (
    input.locationType?.toLowerCase().includes("on-site") ||
    input.locationType?.toLowerCase().includes("onsite")
  ) {
    if (
      !(input.locationText ?? "").toLowerCase().includes("cleveland") &&
      !(input.locationText ?? "").toLowerCase().includes("oh")
    ) {
      score -= 28;
      rejected = true;
      reasonsAgainst.push(
        "On-site requirement appears to be outside the Greater Cleveland preference area.",
      );
    }
  }

  const mismatch = mismatchKeywords.find((keyword) => haystack.includes(keyword));
  if (mismatch) {
    score -= 24;
    reasonsAgainst.push(
      `The role appears mismatched for target seniority or function (${mismatch}).`,
    );
  }

  if (haystack.includes("staffing") || haystack.includes("recruiter")) {
    score -= 8;
    reasonsAgainst.push("This appears to involve a recruiter or staffing intermediary.");
  }

  score = Math.max(0, Math.min(100, score));

  let recommendation: Tier0Result["recommendation"] = "review";
  if (rejected || score < 35) {
    recommendation = "skip";
  } else if (score >= 75) {
    recommendation = "tailor";
  } else if (score >= 60 && reasonsAgainst.length > 0) {
    recommendation = "deep_review_recommended";
  }

  const summary =
    recommendation === "skip"
      ? "Tier 0 rules suggest this job is likely not worth spending time or budget on yet."
      : recommendation === "deep_review_recommended"
        ? "Tier 0 sees real potential here, but there are enough ambiguities that a deeper review may be worthwhile."
        : recommendation === "tailor"
          ? "Tier 0 sees a strong enough fit to move toward tailoring work."
          : "Tier 0 sees enough fit to keep this in the review queue.";

  return {
    overallScore: score,
    recommendation,
    summary,
    reasonsFor,
    reasonsAgainst,
    rejected,
  };
}
