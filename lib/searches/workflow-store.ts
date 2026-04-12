import { eq } from "drizzle-orm";

import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { db } from "@/lib/db/client";
import { savedSearches } from "@/lib/db/schema/saved-searches";
import { buildSavedSearchPayload } from "@/lib/searches/runner";
import { listSavedSearches } from "@/lib/searches/queries";

const demoSavedSearchRecipes = [
  {
    name: "Demo ATS | Speechify Software",
    keywords: "software, software engineer, engineer, remote",
    sources: ["greenhouse", "direct_urls"],
    cadence: "manual",
    trackedUrlsText: "https://boards.greenhouse.io/speechify",
    strictKeywordMatch: true,
  },
  {
    name: "Demo ATS | HappyCo Software",
    keywords: "software, software engineer, engineer, remote",
    sources: ["lever", "direct_urls"],
    cadence: "manual",
    trackedUrlsText: "https://jobs.lever.co/happyco",
    strictKeywordMatch: true,
  },
  {
    name: "Demo ATS | Workday Software",
    keywords: "software, software engineer, engineer, remote",
    sources: ["workday", "direct_urls"],
    cadence: "manual",
    trackedUrlsText: "https://workday.wd5.myworkdayjobs.com/en-US/Workday",
    strictKeywordMatch: true,
  },
  {
    name: "Demo Browser | Operations Remote",
    keywords: "operations manager remote",
    sources: ["google_jobs", "linkedin", "indeed"],
    cadence: "manual",
    trackedUrlsText: "",
    strictKeywordMatch: true,
  },
] as const;

function extractTrackedUrls(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { trackedUrls?: string[] };
    return new Set((parsed.trackedUrls ?? []).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

export async function createSavedSearch(input: {
  name: string;
  keywords: string;
  sources: string[];
  cadence: string;
  trackedUrlsText: string;
  strictKeywordMatch: boolean;
}) {
  await ensureDefaultRecords();

  if (!input.name.trim() || !input.keywords.trim()) {
    return {
      ok: false as const,
      message: "Name and keywords are required to create a saved search.",
    };
  }

  const payload = buildSavedSearchPayload(input);
  await db
    .insert(savedSearches)
    .values({
      ...payload,
      type: "full_time",
      isActive: true,
    })
    .run();

  return {
    ok: true as const,
    message: "Saved search created.",
  };
}

export async function seedDemoSavedSearches() {
  await ensureDefaultRecords();

  const existingSearches = await listSavedSearches();
  let createdCount = 0;

  for (const recipe of demoSavedSearchRecipes) {
    const recipeTrackedUrls = new Set(
      recipe.trackedUrlsText
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    );
    const alreadyExists = existingSearches.some((search) => {
      if (search.name === recipe.name) {
        return true;
      }

      const trackedUrls = extractTrackedUrls(search.filtersJson);
      return [...recipeTrackedUrls].some((trackedUrl) => trackedUrls.has(trackedUrl));
    });

    if (alreadyExists) {
      continue;
    }

    const payload = buildSavedSearchPayload({
      ...recipe,
      sources: [...recipe.sources],
    });
    await db
      .insert(savedSearches)
      .values({
        ...payload,
        type: "full_time",
        isActive: true,
      })
      .run();
    createdCount += 1;
  }

  return {
    ok: true as const,
    createdCount,
    message:
      createdCount > 0
        ? `Seeded ${createdCount} demo ATS saved search${createdCount === 1 ? "" : "es"}.`
        : "Demo ATS saved searches are already present.",
  };
}

export async function seedBrowserDemoSearch() {
  await ensureDefaultRecords();

  const existingSearches = await listSavedSearches();
  const recipe = demoSavedSearchRecipes.find(
    (search) => search.name === "Demo Browser | Operations Remote",
  );

  if (!recipe) {
    return {
      ok: false as const,
      message: "Browser demo recipe could not be found.",
    };
  }

  const alreadyExists = existingSearches.some((search) => search.name === recipe.name);
  if (alreadyExists) {
    return {
      ok: true as const,
      message: "Browser-backed demo search is already present.",
    };
  }

  const payload = buildSavedSearchPayload({
    ...recipe,
    sources: [...recipe.sources],
  });

  await db
    .insert(savedSearches)
    .values({
      ...payload,
      type: "full_time",
      isActive: true,
    })
    .run();

  return {
    ok: true as const,
    message: "Browser-backed demo search created.",
  };
}

export async function toggleSavedSearch(input: {
  searchId: number;
  nextState: boolean;
}) {
  if (!Number.isFinite(input.searchId)) {
    return {
      ok: false as const,
      message: "Saved search could not be updated.",
    };
  }

  await db
    .update(savedSearches)
    .set({
      isActive: input.nextState,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(savedSearches.id, input.searchId))
    .run();

  return {
    ok: true as const,
    message: "Saved search updated.",
  };
}
