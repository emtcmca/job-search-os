import { withBrowserPage } from "@/lib/playwright/browser";

type BrowserSource = "google_jobs" | "linkedin" | "indeed";

type BrowserSourceCandidate = {
  source: BrowserSource;
  url: string;
  title: string | null;
  company: string | null;
  location: string | null;
  snippet: string | null;
};

type RawCandidate = {
  url: string;
  title: string | null;
  company: string | null;
  location: string | null;
  snippet: string | null;
};

type SourceCollectorInput = {
  source: BrowserSource;
  keywords: string;
  browserType: string | null;
  browserProfileName: string | null;
  connectionMode?: string | null;
  debugPort?: number | null;
};

function buildSearchUrl(source: BrowserSource, keywords: string) {
  const query = encodeURIComponent(keywords.trim());

  if (source === "google_jobs") {
    return `https://www.google.com/search?q=${query}&ibp=htl;jobs`;
  }

  if (source === "linkedin") {
    return `https://www.linkedin.com/jobs/search/?keywords=${query}`;
  }

  return `https://www.indeed.com/jobs?q=${query}`;
}

function normalizeGoogleCandidateUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes("google.") && parsed.pathname === "/url") {
      const target = parsed.searchParams.get("q") ?? parsed.searchParams.get("url");
      if (target) {
        return new URL(target).toString();
      }
    }

    if (parsed.hostname.includes("google.")) {
      if (
        parsed.hash.includes("vssid=jobs-detail-viewer") ||
        parsed.searchParams.get("udm") === "8"
      ) {
        return parsed.toString();
      }

      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function parseGoogleJobsCardText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const segments = normalized
    .split(" ShareFacebookWhatsAppXEmailClick to copy linkShare linkLink copied ")[0]
    .split(" • via ")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const title = segments[0] ?? null;
  const companyAndLocation = segments[1] ?? null;

  if (!companyAndLocation) {
    return {
      title,
      company: null,
      location: null,
      snippet: normalized || null,
    };
  }

  const companyLocationParts = companyAndLocation
    .split(" Anywhere ")
    .map((part) => part.trim())
    .filter(Boolean);

  const company = companyLocationParts[0] ?? companyAndLocation;
  const location = companyAndLocation.includes("Anywhere") ? "Anywhere" : null;

  return {
    title,
    company,
    location,
    snippet: normalized || null,
  };
}

function parseLinkedInSnippet(input: { title: string | null; snippet: string | null }) {
  const normalizedSnippet = input.snippet?.replace(/\s+/g, " ").trim() ?? "";
  const normalizedTitle = input.title?.replace(/\s+/g, " ").trim() ?? "";

  if (!normalizedSnippet || !normalizedTitle) {
    return {
      company: null,
      location: null,
      snippet: normalizedSnippet || input.snippet,
    };
  }

  let remainder = normalizedSnippet;
  if (remainder.startsWith(normalizedTitle)) {
    remainder = remainder.slice(normalizedTitle.length).trim();
  }
  if (remainder.startsWith(normalizedTitle)) {
    remainder = remainder.slice(normalizedTitle.length).trim();
  }

  const locationMatch = remainder.match(
    /\b([A-Z][A-Za-z.'()& -]+(?:,\s*[A-Z]{2})?|United States|Remote|Anywhere|New York City Metropolitan Area)\b/,
  );

  const location = locationMatch?.[1]?.trim() ?? null;
  const company = locationMatch
    ? remainder.slice(0, locationMatch.index).trim().replace(/[•|]+$/, "").trim() || null
    : null;

  return {
    company,
    location,
    snippet: normalizedSnippet,
  };
}

async function collectGoogleJobsCandidates(input: {
  page: import("playwright-core").Page;
  searchUrl: string;
}): Promise<RawCandidate[]> {
  const { page, searchUrl } = input;
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  return page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[href*='vssid=jobs-detail-viewer']"),
    );
    const seen = new Set<string>();
    const results: Array<{
      url: string;
      title: string | null;
      company: string | null;
      location: string | null;
      snippet: string | null;
    }> = [];

    for (const anchor of anchors) {
      const href = anchor.href?.trim();
      if (!href) {
        continue;
      }

      const text = anchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (text.length < 12) {
        continue;
      }

      if (seen.has(href)) {
        continue;
      }

      const cardText = anchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
      results.push({
        url: href,
        title: text || null,
        company: null,
        location: null,
        snippet: cardText || null,
      });
      seen.add(href);

      if (results.length >= 10) {
        break;
      }
    }

    return results;
  }).then((results) =>
    results.map((result) => {
      const parsed = parseGoogleJobsCardText(result.snippet ?? result.title ?? "");
      return {
        ...result,
        title: parsed.title ?? result.title,
        company: parsed.company,
        location: parsed.location,
        snippet: parsed.snippet,
      };
    }),
  );
}

async function collectLinkedInCandidates(input: {
  page: import("playwright-core").Page;
  searchUrl: string;
}): Promise<RawCandidate[]> {
  const { page, searchUrl } = input;
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  return page
    .evaluate(() => {
      const anchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a[href*='/jobs/view/']"),
      );
    const seen = new Set<string>();
    const results: Array<{
      url: string;
      title: string | null;
      company: string | null;
      location: string | null;
      snippet: string | null;
    }> = [];

    for (const anchor of anchors) {
      const href = anchor.href?.trim();
      if (!href || seen.has(href)) {
        continue;
      }

      const title = anchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const card = anchor.closest("li") ?? anchor.closest("div");
      const cardText = card?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      results.push({
        url: href,
        title: title || null,
        company: null,
        location: null,
        snippet: cardText || null,
      });
      seen.add(href);

      if (results.length >= 10) {
        break;
      }
    }

      return results;
    })
    .then((results) =>
      results.map((result) => {
        const parsed = parseLinkedInSnippet({
          title: result.title,
          snippet: result.snippet,
        });

        return {
          ...result,
          company: parsed.company,
          location: parsed.location,
          snippet: parsed.snippet,
        };
      }),
    );
}

async function collectIndeedCandidates(input: {
  page: import("playwright-core").Page;
  searchUrl: string;
}): Promise<RawCandidate[]> {
  const { page, searchUrl } = input;
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  return page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[href*='/viewjob'], a[href*='jk=']"),
    );
    const seen = new Set<string>();
    const results: Array<{
      url: string;
      title: string | null;
      company: string | null;
      location: string | null;
      snippet: string | null;
    }> = [];

    for (const anchor of anchors) {
      const href = anchor.href?.trim();
      if (!href || seen.has(href)) {
        continue;
      }

      const title = anchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (
        !title ||
        /^view similar jobs/i.test(title) ||
        /salaries?/i.test(title)
      ) {
        continue;
      }

      const card = anchor.closest("[data-jk]") ?? anchor.closest("div");
      const cardText = card?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      results.push({
        url: href,
        title: title || null,
        company: null,
        location: null,
        snippet: cardText || null,
      });
      seen.add(href);

      if (results.length >= 10) {
        break;
      }
    }

    return results;
  });
}

export async function collectBrowserSourceCandidates(
  input: SourceCollectorInput,
): Promise<BrowserSourceCandidate[]> {
  const searchUrl = buildSearchUrl(input.source, input.keywords);

  const rawCandidates = await withBrowserPage({
    browserType: input.browserType,
    browserProfileName: input.browserProfileName,
    connectionMode: input.connectionMode,
    debugPort: input.debugPort,
    handler: async (page) => {
      if (input.source === "google_jobs") {
        return collectGoogleJobsCandidates({ page, searchUrl });
      }

      if (input.source === "linkedin") {
        return collectLinkedInCandidates({ page, searchUrl });
      }

      return collectIndeedCandidates({ page, searchUrl });
    },
  });

  const normalized =
    input.source === "google_jobs"
      ? rawCandidates
          .map((candidate) => ({
            ...candidate,
            url: normalizeGoogleCandidateUrl(candidate.url),
          }))
          .filter(
            (candidate): candidate is RawCandidate & { url: string } =>
              Boolean(candidate.url),
          )
      : rawCandidates
          .map((candidate) => {
            try {
              return {
                ...candidate,
                url: new URL(candidate.url).toString(),
              };
            } catch {
              return null;
            }
          })
          .filter(
            (candidate): candidate is RawCandidate & { url: string } => Boolean(candidate?.url),
          );

  return normalized.map((candidate) => ({
    source: input.source,
    url: candidate.url,
    title: candidate.title,
    company: candidate.company,
    location: candidate.location,
    snippet: candidate.snippet,
  }));
}
