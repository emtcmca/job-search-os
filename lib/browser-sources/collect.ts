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

function cleanGoogleSnippet(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\bNEW\b/gi, "")
    .replace(/^[A-Z]\s+/, "")
    .replace(/ShareFacebookWhatsAppXEmailClick to copy linkShare linkLink copied/gi, "")
    .trim();
}

async function collectGoogleJobsCandidates(input: {
  page: import("playwright-core").Page;
  searchUrl: string;
}): Promise<RawCandidate[]> {
  const { page, searchUrl } = input;
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  const anchorLocator = page.locator("a[href*='vssid=jobs-detail-viewer']");
  const anchorCount = await anchorLocator.count();
  const results: RawCandidate[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < Math.min(anchorCount, 10); index += 1) {
    const anchor = anchorLocator.nth(index);
    const extracted = await anchor.evaluate((element) => {
      const href = (element as HTMLAnchorElement).href?.trim() ?? "";
      const title =
        element.querySelector(".tNxQIb.PUpOsf")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const company =
        element
          .querySelector(".wHYlTd.MKCbgd.a3jPc")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "";
      const locationAndSource =
        element
          .querySelector(".wHYlTd.FqK3wc.MKCbgd")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "";
      const snippet = element.textContent?.replace(/\s+/g, " ").trim() ?? "";

      return {
        href,
        title,
        company,
        locationAndSource,
        snippet,
      };
    });

    if (!extracted.href || extracted.title.length < 3 || seen.has(extracted.href)) {
      continue;
    }

    await anchor.click();
    await page.waitForTimeout(1200);

    const viaMarkerIndex = extracted.locationAndSource.toLowerCase().lastIndexOf(" via ");
    const sourceLabel =
      viaMarkerIndex >= 0
        ? extracted.locationAndSource.slice(viaMarkerIndex + 5).trim() || null
        : null;

    const outboundUrl =
      (await page.evaluate((currentSourceLabel) => {
        const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));

        const sourceMatched = currentSourceLabel
          ? anchors.find((anchor) => {
              const href = anchor.href?.trim() ?? "";
              const text = anchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
              return (
                href.length > 0 &&
                !href.includes("google.com") &&
                text.toLowerCase().includes(currentSourceLabel.toLowerCase())
              );
            })
          : null;

        if (sourceMatched?.href) {
          return sourceMatched.href;
        }

        const preferred = anchors.find((anchor) => {
          const href = anchor.href?.trim() ?? "";
          const text = anchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
          return (
            href.length > 0 &&
            !href.includes("google.com") &&
            (/Apply on/i.test(text) || /Apply directly/i.test(text) || /google_jobs_apply/i.test(href))
          );
        });

        if (preferred?.href) {
          return preferred.href;
        }

        const fallback = anchors.find((anchor) => {
          const href = anchor.href?.trim() ?? "";
          return href.length > 0 && !href.includes("google.com");
        });

        return fallback?.href ?? null;
      }, sourceLabel)) ?? extracted.href;

    const location = extracted.locationAndSource
      ? (viaMarkerIndex >= 0
          ? extracted.locationAndSource.slice(0, viaMarkerIndex)
          : extracted.locationAndSource)
          .replace(/[^\p{L}\p{N})]+$/u, "")
          .trim() || null
      : null;

    results.push({
      url: outboundUrl,
      title: extracted.title || null,
      company: extracted.company || null,
      location,
      snippet: cleanGoogleSnippet(extracted.snippet) || null,
    });
    seen.add(extracted.href);
  }

  return results;
}

async function collectLinkedInCandidates(input: {
  page: import("playwright-core").Page;
  searchUrl: string;
}): Promise<RawCandidate[]> {
  const { page, searchUrl } = input;
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  const anchorLocator = page.locator("a[href*='/jobs/view/']");
  const anchorCount = await anchorLocator.count();
  const results: RawCandidate[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < Math.min(anchorCount, 10); index += 1) {
    const anchor = anchorLocator.nth(index);
    const candidate = await anchor.evaluate((element) => {
      const href = (element as HTMLAnchorElement).href?.trim() ?? "";
      const title =
        element.querySelector("span[aria-hidden='true'], strong")?.textContent?.replace(/\s+/g, " ").trim() ??
        element.textContent?.replace(/\s+/g, " ").trim() ??
        "";
      const card = element.closest(".job-card-container") ?? element.closest("li") ?? element.closest("div");
      const company =
        card
          ?.querySelector(".artdeco-entity-lockup__subtitle")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "";
      const location =
        card
          ?.querySelector(".artdeco-entity-lockup__caption")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "";
      const snippet = card?.textContent?.replace(/\s+/g, " ").trim() ?? "";

      return {
        href,
        title,
        company,
        location,
        snippet,
      };
    });

    if (!candidate.href || !candidate.title || seen.has(candidate.href)) {
      continue;
    }

    results.push({
      url: candidate.href,
      title: candidate.title,
      company: candidate.company || null,
      location: candidate.location || null,
      snippet: candidate.snippet || null,
    });
    seen.add(candidate.href);
  }

  return results;
}

async function collectIndeedCandidates(input: {
  page: import("playwright-core").Page;
  searchUrl: string;
}): Promise<RawCandidate[]> {
  const { page, searchUrl } = input;
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  const anchorLocator = page.locator("a.jcs-JobTitle, a[href*='/viewjob'], a[href*='jk=']");
  const anchorCount = await anchorLocator.count();
  const results: RawCandidate[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < Math.min(anchorCount, 10); index += 1) {
    const anchor = anchorLocator.nth(index);
    const candidate = await anchor.evaluate((element) => {
      const href = (element as HTMLAnchorElement).href?.trim() ?? "";
      const title = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const card =
        element.closest(".job_seen_beacon") ??
        element.closest("table.mainContentTable") ??
        element.closest("td.resultContent") ??
        element.closest("div");
      const company =
        card
          ?.querySelector("[data-testid='company-name']")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "";
      const location =
        card
          ?.querySelector("[data-testid='text-location']")
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? "";
      const snippet = card?.textContent?.replace(/\s+/g, " ").trim() ?? "";

      return {
        href,
        title,
        company,
        location,
        snippet,
      };
    });

    if (
      !candidate.href ||
      !candidate.title ||
      /^view similar jobs/i.test(candidate.title) ||
      /salaries?/i.test(candidate.title) ||
      seen.has(candidate.href)
    ) {
      continue;
    }

    results.push({
      url: candidate.href,
      title: candidate.title,
      company: candidate.company || null,
      location: candidate.location || null,
      snippet: candidate.snippet || null,
    });
    seen.add(candidate.href);
  }

  return results;
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
            (candidate): candidate is RawCandidate & { url: string } => Boolean(candidate.url),
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


