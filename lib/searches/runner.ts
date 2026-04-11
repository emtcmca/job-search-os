import { eq } from "drizzle-orm";

import { collectBrowserSourceCandidates } from "@/lib/browser-sources/collect";
import { db } from "@/lib/db/client";
import { platformConnections } from "@/lib/db/schema/integrations";
import { savedSearches } from "@/lib/db/schema/saved-searches";
import { importJob } from "@/lib/jobs/import-job";
import { inspectBrowserAutomation } from "@/lib/playwright/profile";
import { getSavedSearch, listSavedSearches } from "@/lib/searches/queries";

type SavedSearchFilters = {
  trackedUrls?: string[];
  strictKeywordMatch?: boolean;
};

type SavedSearchSchedule = {
  cadence?: string;
};

function parseKeywordList(keywords: string) {
  return keywords
    .split(/[\n,]/)
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractLinks(html: string, baseUrl: string) {
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const links = matches
    .map((match) => {
      try {
        const href = new URL(match[1], baseUrl).toString();
        const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return { href, text };
      } catch {
        return null;
      }
    })
    .filter((link): link is { href: string; text: string } => Boolean(link));

  return Array.from(new Map(links.map((link) => [link.href, link])).values());
}

function looksLikeJobLink(url: string, anchorText: string) {
  const candidate = `${url} ${anchorText}`.toLowerCase();
  return /(job|jobs|career|careers|opening|openings|position|positions|apply|posting|opportunit)/.test(
    candidate,
  );
}

async function fetchPage(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false as const, html: null, reason: `HTTP ${response.status}` };
    }

    return { ok: true as const, html: await response.text(), reason: null };
  } catch {
    return { ok: false as const, html: null, reason: "network_error" };
  }
}

function matchesKeywords(text: string, keywords: string[]) {
  if (keywords.length === 0) {
    return true;
  }

  return keywords.some((keyword) => text.includes(keyword));
}

export async function runSavedSearch(searchId: number) {
  const search = getSavedSearch(searchId);
  if (!search) {
    return { ok: false as const, message: "Saved search not found." };
  }

  const filters = JSON.parse(search.filtersJson) as SavedSearchFilters;
  const trackedUrls = (filters.trackedUrls ?? []).filter(Boolean);
  const keywords = parseKeywordList(search.keywords);
  const selectedSources = JSON.parse(search.sourcesJson) as string[];

  const browserDrivenSources = ["google_jobs", "linkedin", "indeed", "upwork", "fiverr"];
  const hasBrowserDrivenSource = selectedSources.some((source) =>
    browserDrivenSources.includes(source),
  );

  if (trackedUrls.length === 0 && !hasBrowserDrivenSource) {
    return {
      ok: false as const,
      message:
        "This saved search has no tracked URLs yet. Add direct company, careers, or board URLs first.",
    };
  }

  const candidateUrls = new Set<string>();
  let discoveredPages = 0;
  const notes: string[] = [];

  const connections = db.select().from(platformConnections).all();
  const sessionBackedSources = ["google_jobs", "linkedin", "indeed", "upwork", "fiverr"];
  const browserImportCandidates = [];

  for (const source of selectedSources) {
    if (!sessionBackedSources.includes(source)) {
      continue;
    }

    const connection = connections.find((item) => item.platform === source);
    if (!connection) {
      notes.push(
        `${source} is selected for this search but no platform connection record exists yet.`,
      );
      continue;
    }

    if (!connection.isEnabled) {
      notes.push(
        `${source} is selected for this search but its browser-backed connection is not enabled yet.`,
      );
      continue;
    }

    const inspection = inspectBrowserAutomation({
      isEnabled: connection.isEnabled,
      browserType: connection.browserType,
      browserProfileName: connection.browserProfileName,
    });

    if (inspection.status !== "ready") {
      notes.push(`${source} is enabled but not ready yet. ${inspection.message}`);
      continue;
    }

    if (source === "google_jobs" || source === "linkedin" || source === "indeed") {
      try {
        const candidates = await collectBrowserSourceCandidates({
          source,
          keywords: search.keywords,
          browserType: connection.browserType,
          browserProfileName: connection.browserProfileName,
          connectionMode: connection.connectionMode,
          debugPort: connection.debugPort,
        });

        for (const candidate of candidates) {
          browserImportCandidates.push(candidate);
        }

        notes.push(
          `${source} returned ${candidates.length} browser-assisted candidate links using ${inspection.browserType} profile "${inspection.requestedProfileName}".`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown browser collector error.";
        notes.push(`${source} browser-assisted collection failed. ${message}`);
      }
      continue;
    }

    notes.push(
      `${source} is connected to ${inspection.browserType} profile "${inspection.requestedProfileName}" and ready for browser-assisted ingestion once that collector is added.`,
    );
  }

  for (const trackedUrl of trackedUrls) {
    const page = await fetchPage(trackedUrl);
    if (!page.ok || !page.html) {
      notes.push(`Could not scan ${trackedUrl} (${page.reason}).`);
      continue;
    }

    discoveredPages += 1;
    const pageText = stripHtmlToText(page.html);
    const pageLinks = extractLinks(page.html, trackedUrl);

    if (!filters.strictKeywordMatch || matchesKeywords(pageText, keywords)) {
      candidateUrls.add(trackedUrl);
    }

    for (const link of pageLinks) {
      if (candidateUrls.size >= 15) {
        break;
      }

      const searchableText = `${link.href} ${link.text}`.toLowerCase();
      if (!looksLikeJobLink(link.href, link.text)) {
        continue;
      }

      if (!filters.strictKeywordMatch || matchesKeywords(searchableText, keywords)) {
        candidateUrls.add(link.href);
      }
    }
  }

  const imports = [];
  const importedBrowserUrls = new Set<string>();
  for (const candidateUrl of candidateUrls) {
    const result = await importJob({ url: candidateUrl });
    imports.push(result);
    importedBrowserUrls.add(candidateUrl);
  }

  for (const candidate of browserImportCandidates) {
    if (importedBrowserUrls.has(candidate.url)) {
      continue;
    }

    const result = await importJob({
      url: candidate.url,
      manualTitle: candidate.title ?? undefined,
      manualCompany: candidate.company ?? undefined,
      manualLocation: candidate.location ?? undefined,
      rawDescription: candidate.snippet ?? undefined,
    });
    imports.push(result);
    importedBrowserUrls.add(candidate.url);
  }

  const importedCount = imports.filter((result) => result.ok).length;
  const warningCount = imports.filter((result) => result.ok && result.warning).length;
  const errorCount = imports.filter((result) => !result.ok).length;
  const attemptedImports = candidateUrls.size + browserImportCandidates.length;

  db.update(savedSearches)
    .set({
      lastRunAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(savedSearches.id, searchId))
    .run();

  return {
    ok: true as const,
    message: `Scanned ${discoveredPages} tracked pages, attempted ${attemptedImports} imports, saved ${importedCount} jobs, and saw ${warningCount} warnings.`,
    importedCount,
    warningCount,
    errorCount,
    notes,
  };
}

export async function runActiveSavedSearches() {
  const searches = listSavedSearches().filter((search) => search.isActive);
  const results = [];

  for (const search of searches) {
    results.push({
      searchId: search.id,
      name: search.name,
      result: await runSavedSearch(search.id),
    });
  }

  return results;
}

export function buildSavedSearchPayload(input: {
  name: string;
  keywords: string;
  sources: string[];
  cadence: string;
  trackedUrlsText: string;
  strictKeywordMatch: boolean;
}) {
  const trackedUrls = input.trackedUrlsText
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);

  return {
    name: input.name.trim(),
    keywords: input.keywords.trim(),
    sourcesJson: JSON.stringify(input.sources),
    scheduleJson: JSON.stringify({ cadence: input.cadence } satisfies SavedSearchSchedule),
    filtersJson: JSON.stringify({
      trackedUrls,
      strictKeywordMatch: input.strictKeywordMatch,
    } satisfies SavedSearchFilters),
  };
}
