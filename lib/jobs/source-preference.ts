export const browserBackedJobSources = ["google_jobs", "linkedin", "indeed"] as const;

const sourcePriorityMap: Record<string, number> = {
  greenhouse: 100,
  lever: 95,
  workday: 90,
  direct_urls: 85,
  company_pages: 80,
  linkedin: 45,
  indeed: 40,
  google_jobs: 35,
};

export function getJobSourcePriority(source: string | null | undefined) {
  if (!source) {
    return 50;
  }

  return sourcePriorityMap[source] ?? 50;
}

export function isBrowserBackedJobSource(source: string | null | undefined) {
  return browserBackedJobSources.includes(
    (source ?? "") as (typeof browserBackedJobSources)[number],
  );
}
