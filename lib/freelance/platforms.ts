export const freelancePlatforms = ["Upwork", "Toptal", "Contra", "Fiverr", "Indeed"] as const;

export type FreelancePlatform = (typeof freelancePlatforms)[number];

export type PlatformKnowledge = {
  key: FreelancePlatform;
  source: string;
  format: "upwork" | "fiverr" | "generic";
  rules: string[];
  proposalRules: string[];
  listingRules: string[];
};

export const platformKnowledge: Record<FreelancePlatform, PlatformKnowledge> = {
  Upwork: {
    key: "Upwork",
    source: "upwork",
    format: "upwork",
    rules: [
      "Project Catalog title max 75 characters and should not include 'You will get'.",
      "Use Starter, Standard, and Advanced tiers.",
      "First 160 description characters must work as a search hook.",
      "Use no more than five search tags.",
      "Tone should be enterprise-facing, concrete, and outcome-driven.",
    ],
    proposalRules: [
      "Open with the client's problem, not a generic greeting.",
      "Show the relevant operator proof point in one sentence.",
      "Name a concise plan and a low-friction next step.",
      "Avoid sounding like a mass proposal.",
    ],
    listingRules: [
      "Return catalogTitle, category, searchTags, descriptionHook, fullDescription, tiers, addOns, and clientRequirements.",
      "Starter should be a narrow audit or review.",
      "Standard should be the complete expected scope.",
      "Advanced should include deeper implementation or enablement.",
    ],
  },
  Fiverr: {
    key: "Fiverr",
    source: "fiverr",
    format: "fiverr",
    rules: [
      "Gig title must start with 'I will' and stay under 80 characters.",
      "Use Basic, Standard, and Premium packages.",
      "Description should stay under 1,200 characters.",
      "Use no more than five tags.",
      "Tone should be clear, buyer-friendly, and specific.",
    ],
    proposalRules: [
      "Keep the response direct and service-oriented.",
      "Translate the request into a packaged scope.",
      "Mention exactly what the buyer receives.",
      "End with one simple order or message prompt.",
    ],
    listingRules: [
      "Return gigTitle, tags, packages, description, requirements, and gigExtras.",
      "Basic should be small and easy to buy.",
      "Standard should be the likely best-value package.",
      "Premium should include deeper review, documentation, and support.",
    ],
  },
  Toptal: {
    key: "Toptal",
    source: "toptal",
    format: "generic",
    rules: [
      "Executive tone for VP, COO, founder, and program leadership buyers.",
      "Position Eric as a senior operator and workflow architect.",
      "Favor hourly or advisory engagement framing.",
      "Use rates in the $100-$200/hr range only as guidance, not as a promise.",
    ],
    proposalRules: [
      "Lead with strategic diagnosis and operating credibility.",
      "Avoid marketplace-y package language.",
      "Frame the first engagement as discovery, audit, or implementation planning.",
      "Show judgment and constraints clearly.",
    ],
    listingRules: [
      "Return listingTitle, tagline, overview, deliverables, idealClient, notFor, pricingGuidance, callToAction, keywords, and platformNotes.",
      "Make it suitable for senior consulting buyers.",
    ],
  },
  Contra: {
    key: "Contra",
    source: "contra",
    format: "generic",
    rules: [
      "Portfolio-driven positioning with clear outcomes.",
      "Emphasize project narrative, deliverables, and proof.",
      "Use $75-$150/hr or fixed-scope packages as guidance.",
      "Avoid generic consultant language.",
    ],
    proposalRules: [
      "Connect the project to a portfolio-style outcome.",
      "Describe how the work will look when done.",
      "Keep the tone independent, confident, and concise.",
    ],
    listingRules: [
      "Return listingTitle, tagline, overview, deliverables, idealClient, notFor, pricingGuidance, callToAction, keywords, and platformNotes.",
      "Make the listing readable as a standalone portfolio service.",
    ],
  },
  Indeed: {
    key: "Indeed",
    source: "indeed",
    format: "generic",
    rules: [
      "Resume-professional contract or freelance role positioning.",
      "Use direct, credential-backed language.",
      "Avoid marketplace package assumptions unless the post asks for them.",
      "Make fit reasoning explicit because Indeed posts are often role-like.",
    ],
    proposalRules: [
      "Sound like a targeted contract-role note.",
      "Map experience to requirements.",
      "Name availability, fit, and next step succinctly.",
    ],
    listingRules: [
      "Return listingTitle, tagline, overview, deliverables, idealClient, notFor, pricingGuidance, callToAction, keywords, and platformNotes.",
      "Make the result usable as profile or service copy, not a traditional job application.",
    ],
  },
};

export function normalizeFreelancePlatform(value: string): FreelancePlatform {
  const match = freelancePlatforms.find(
    (platform) => platform.toLowerCase() === value.trim().toLowerCase(),
  );

  return match ?? "Upwork";
}

export function getPlatformKnowledge(value: string) {
  return platformKnowledge[normalizeFreelancePlatform(value)];
}
