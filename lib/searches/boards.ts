type BoardSource = "greenhouse" | "lever" | "workday";

export type BoardCandidate = {
  source: BoardSource;
  boardUrl: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  snippet: string | null;
  rawDescription: string | null;
};

type CollectBoardCandidatesInput = {
  trackedUrl: string;
  keywords: string[];
  strictKeywordMatch: boolean;
};

function prettifyToken(token: string) {
  return token
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, maxLength = 280) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3).trim()}...`;
}

function countKeywordHits(text: string, keywords: string[]) {
  return keywords.reduce((count, keyword) => (text.includes(keyword) ? count + 1 : count), 0);
}

function scoreKeywordRelevance(input: {
  title: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
  keywords: string[];
}) {
  const normalizedTitle = input.title.toLowerCase();
  const normalizedCompany = (input.company ?? "").toLowerCase();
  const normalizedLocation = (input.location ?? "").toLowerCase();
  const normalizedDescription = (input.description ?? "").toLowerCase();

  const titleHits = countKeywordHits(normalizedTitle, input.keywords);
  const companyHits = countKeywordHits(normalizedCompany, input.keywords);
  const locationHits = countKeywordHits(normalizedLocation, input.keywords);
  const descriptionHits = countKeywordHits(normalizedDescription, input.keywords);

  return {
    titleHits,
    companyHits,
    locationHits,
    descriptionHits,
    score: titleHits * 5 + companyHits * 2 + locationHits * 2 + descriptionHits,
  };
}

function extractGreenhouseToken(url: URL) {
  if (!url.hostname.toLowerCase().includes("greenhouse")) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const boardToken = segments[segments[0] === "embed" ? 1 : 0] ?? null;
  return boardToken;
}

async function collectGreenhouseCandidates(input: CollectBoardCandidatesInput & { url: URL }) {
  const token = extractGreenhouseToken(input.url);
  if (!token) {
    return null;
  }

  const response = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Greenhouse API returned ${response.status} for ${input.trackedUrl}.`);
  }

  const data = (await response.json()) as {
    jobs?: Array<{
      absolute_url?: string;
      title?: string;
      content?: string;
      location?: { name?: string | null };
    }>;
  };

  const company = prettifyToken(token);
  const rankedCandidates: Array<BoardCandidate & { relevanceScore: number }> = [];

  for (const job of data.jobs ?? []) {
    const rawDescription = job.content ? stripHtmlToText(job.content) : "";
    const relevance = scoreKeywordRelevance({
      title: job.title ?? "",
      company,
      location: job.location?.name ?? "",
      description: rawDescription,
      keywords: input.keywords,
    });

    if (
      !job.absolute_url ||
      !job.title ||
      (input.strictKeywordMatch &&
        input.keywords.length > 0 &&
        relevance.titleHits === 0 &&
        relevance.locationHits === 0 &&
        relevance.score < 4)
    ) {
      continue;
    }

    rankedCandidates.push({
      source: "greenhouse",
      boardUrl: input.trackedUrl,
      url: job.absolute_url,
      title: job.title,
      company,
      location: job.location?.name?.trim() || null,
      snippet: rawDescription ? truncate(rawDescription) : null,
      rawDescription: rawDescription || null,
      relevanceScore: relevance.score,
    });
  }

  return rankedCandidates
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .map(({ relevanceScore: _relevanceScore, ...candidate }) => candidate);
}

function extractLeverAccount(url: URL) {
  if (!url.hostname.toLowerCase().includes("lever")) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  return segments[0] ?? null;
}

async function collectLeverCandidates(input: CollectBoardCandidatesInput & { url: URL }) {
  const account = extractLeverAccount(input.url);
  if (!account) {
    return null;
  }

  const response = await fetch(`https://api.lever.co/v0/postings/${account}?mode=json`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Lever API returned ${response.status} for ${input.trackedUrl}.`);
  }

  const data = (await response.json()) as Array<{
    text?: string;
    hostedUrl?: string;
    descriptionPlain?: string;
    listsPlain?: string;
    categories?: {
      location?: string | null;
      team?: string | null;
      commitment?: string | null;
      allLocations?: string[] | null;
    };
  }>;

  const company = prettifyToken(account);
  const rankedCandidates: Array<BoardCandidate & { relevanceScore: number }> = [];

  for (const job of data) {
    const rawDescription = [job.descriptionPlain ?? "", job.listsPlain ?? ""]
      .join("\n\n")
      .trim();
    const location =
      job.categories?.allLocations?.find(Boolean) ??
      job.categories?.location?.trim() ??
      null;
    const relevance = scoreKeywordRelevance({
      title: job.text ?? "",
      company,
      location,
      description: [job.categories?.team ?? "", job.categories?.commitment ?? "", rawDescription]
        .join(" ")
        .trim(),
      keywords: input.keywords,
    });

    if (
      !job.hostedUrl ||
      !job.text ||
      (input.strictKeywordMatch &&
        input.keywords.length > 0 &&
        relevance.titleHits === 0 &&
        relevance.locationHits === 0 &&
        relevance.score < 4)
    ) {
      continue;
    }

    rankedCandidates.push({
      source: "lever",
      boardUrl: input.trackedUrl,
      url: job.hostedUrl,
      title: job.text,
      company,
      location,
      snippet: rawDescription ? truncate(rawDescription) : null,
      rawDescription: rawDescription || null,
      relevanceScore: relevance.score,
    });
  }

  return rankedCandidates
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .map(({ relevanceScore: _relevanceScore, ...candidate }) => candidate);
}

function extractWorkdayConfig(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.includes("workdayjobs")) {
    return null;
  }

  const tenant = hostname.split(".")[0]?.trim();
  const segments = url.pathname.split("/").filter(Boolean);
  const site = segments.at(-1)?.trim();

  if (!tenant || !site) {
    return null;
  }

  return {
    tenant,
    site,
    company: prettifyToken(site),
    boardPath: url.pathname.replace(/\/+$/, ""),
  };
}

function buildWorkdayJobUrl(input: { url: URL; boardPath: string; externalPath: string }) {
  const normalizedExternalPath = input.externalPath.startsWith("/")
    ? input.externalPath
    : `/${input.externalPath}`;

  return `${input.url.origin}${input.boardPath}${normalizedExternalPath}`;
}

async function collectWorkdayCandidates(input: CollectBoardCandidatesInput & { url: URL }) {
  const config = extractWorkdayConfig(input.url);
  if (!config) {
    return null;
  }

  const rankedCandidates: Array<BoardCandidate & { relevanceScore: number }> = [];
  const limit = 20;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const response = await fetch(
      `${input.url.origin}/wday/cxs/${config.tenant}/${config.site}/jobs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit,
          offset,
          searchText: "",
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Workday API returned ${response.status} for ${input.trackedUrl}.`);
    }

    const data = (await response.json()) as {
      total?: number;
      jobPostings?: Array<{
        title?: string;
        externalPath?: string;
        locationsText?: string | null;
        postedOn?: string | null;
        remoteType?: string | null;
        bulletFields?: string[] | null;
      }>;
    };

    const postings = data.jobPostings ?? [];
    total = typeof data.total === "number" ? data.total : offset + postings.length;

    for (const job of postings) {
      const rawDescription = [
        job.locationsText ?? "",
        job.remoteType ? `Remote type: ${job.remoteType}` : "",
        job.postedOn ?? "",
        ...(job.bulletFields ?? []),
      ]
        .filter(Boolean)
        .join(" | ");
      const relevance = scoreKeywordRelevance({
        title: job.title ?? "",
        company: config.company,
        location: job.locationsText ?? "",
        description: rawDescription,
        keywords: input.keywords,
      });

      if (
        !job.externalPath ||
        !job.title ||
        (input.strictKeywordMatch &&
          input.keywords.length > 0 &&
          relevance.titleHits === 0 &&
          relevance.locationHits === 0 &&
          relevance.score < 4)
      ) {
        continue;
      }

      rankedCandidates.push({
        source: "workday",
        boardUrl: input.trackedUrl,
        url: buildWorkdayJobUrl({
          url: input.url,
          boardPath: config.boardPath,
          externalPath: job.externalPath,
        }),
        title: job.title,
        company: config.company,
        location: job.locationsText?.trim() || null,
        snippet: rawDescription ? truncate(rawDescription) : null,
        rawDescription: rawDescription || null,
        relevanceScore: relevance.score,
      });
    }

    if (postings.length < limit) {
      break;
    }

    offset += postings.length;
  }

  return rankedCandidates
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .map(({ relevanceScore: _relevanceScore, ...candidate }) => candidate);
}

export async function collectStructuredBoardCandidates(
  input: CollectBoardCandidatesInput,
): Promise<BoardCandidate[] | null> {
  let url: URL;
  try {
    url = new URL(input.trackedUrl);
  } catch {
    return null;
  }

  if (url.hostname.toLowerCase().includes("greenhouse")) {
    return collectGreenhouseCandidates({ ...input, url });
  }

  if (url.hostname.toLowerCase().includes("lever")) {
    return collectLeverCandidates({ ...input, url });
  }

  if (url.hostname.toLowerCase().includes("workdayjobs")) {
    return collectWorkdayCandidates({ ...input, url });
  }

  return null;
}

