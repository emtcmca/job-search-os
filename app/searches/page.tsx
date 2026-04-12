import {
  createSavedSearchAction,
  runSavedSearchAction,
  seedBrowserDemoSearchAction,
  seedDemoSavedSearchesAction,
  toggleSavedSearchAction,
} from "@/app/searches/actions";
import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getHostedPreviewMutationStatus } from "@/lib/runtime/deployment";
import { listSavedSearches } from "@/lib/searches/queries";

type SearchesPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    details?: string;
  }>;
};

function formatSources(raw: string) {
  try {
    const sources = JSON.parse(raw) as string[];
    return sources.length > 0 ? sources.join(", ") : "No sources selected";
  } catch {
    return "No sources selected";
  }
}

function trackedUrlCount(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { trackedUrls?: string[] };
    return parsed.trackedUrls?.length ?? 0;
  } catch {
    return 0;
  }
}

function cadenceLabel(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { cadence?: string };
    return parsed.cadence ?? "manual";
  } catch {
    return "manual";
  }
}

export default async function SearchesPage({ searchParams }: SearchesPageProps) {
  await ensureDefaultRecords();
  const params = searchParams ? await searchParams : undefined;
  const searches = await listSavedSearches();
  const mutationStatus = getHostedPreviewMutationStatus();

  return (
    <PageFrame
      eyebrow="Saved Searches"
      title="Automate the search work, not just the application work."
      description="Saved searches will drive recurring ingestion, source targeting, and search-specific filters so the app can surface only new or changed opportunities."
      metrics={[
        {
          label: "Active Searches",
          value: String(searches.filter((search) => search.isActive).length),
          hint: "Search recipes currently eligible for scheduled runs.",
        },
        {
          label: "Tracked URLs",
          value: String(
            searches.reduce((sum, search) => sum + trackedUrlCount(search.filtersJson), 0),
          ),
          hint: "Career pages, ATS boards, and direct job URLs under watch.",
        },
      ]}
    >
      {params?.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow)] ${
            params.status === "error"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-emerald-300 bg-emerald-50 text-emerald-950"
          }`}
        >
          <div>{params.message}</div>
          {params.details ? (
            <div className="mt-2 whitespace-pre-wrap text-xs opacity-80">{params.details}</div>
          ) : null}
        </div>
      ) : null}

      {mutationStatus.readOnlyHostedPreview ? (
        <ReadOnlyNotice message={mutationStatus.message} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <InfoCard
          title="Create a saved search"
          body="This pass supports both tracked URLs and browser-assisted search sources. Greenhouse, Lever, and Workday tracked board URLs now import structured live postings directly, while Google Jobs, LinkedIn, and Indeed can still run from search keywords even when no tracked URLs are provided."
        >
          <form action={createSavedSearchAction}>
            <fieldset
              disabled={!mutationStatus.writesAllowed}
              className={`space-y-4 ${!mutationStatus.writesAllowed ? "opacity-60" : ""}`}
            >
            <input
              name="name"
              type="text"
              placeholder="Operations roles remote"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              required
            />
            <textarea
              name="keywords"
              rows={3}
              required
              placeholder="operations manager, workflow, process improvement, implementation"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm">
                <div className="font-medium">Cadence</div>
                <select
                  name="cadence"
                  defaultValue="manual"
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                >
                  <option value="manual">Manual</option>
                  <option value="hourly">Hourly foundation</option>
                  <option value="twice_daily">Twice daily foundation</option>
                </select>
              </label>
              <label className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm">
                <div className="font-medium">Strict keyword match</div>
                <div className="mt-2 text-[var(--muted)]">
                  Only import candidate pages whose scanned text or links match the keywords.
                </div>
                <input
                  name="strictKeywordMatch"
                  type="checkbox"
                  className="mt-3 h-4 w-4"
                  defaultChecked
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["company_pages", "Company pages"],
                ["greenhouse", "Greenhouse"],
                ["lever", "Lever"],
                ["workday", "Workday"],
                ["google_jobs", "Google Jobs"],
                ["linkedin", "LinkedIn"],
                ["indeed", "Indeed"],
                ["direct_urls", "Direct job URLs"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/70 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="sources"
                    value={value}
                    defaultChecked={value === "company_pages" || value === "direct_urls"}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <textarea
              name="trackedUrls"
              rows={6}
              placeholder={"https://company.com/careers\nhttps://boards.greenhouse.io/company\nhttps://jobs.lever.co/company\nhttps://tenant.wd5.myworkdayjobs.com/en-US/company"}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
            />
            <div className="text-sm text-[var(--muted)]">
              Tracked URLs are optional when you rely on Google Jobs, LinkedIn, or Indeed as query-driven sources.
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save search recipe
            </button>
            </fieldset>
          </form>
        </InfoCard>
        <InfoCard
          title="Saved search recipes"
          body="Each recipe can be run on demand now and later scheduled through the worker script without redesigning the data model."
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]/70 p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">
                Seed known-good ATS demos
              </div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                Add the tested Speechify Greenhouse, HappyCo Lever, and Workday board recipes in one click, then run them immediately to validate live ATS ingestion.
              </div>
              <form action={seedDemoSavedSearchesAction} className="mt-3">
                <button
                  type="submit"
                  disabled={!mutationStatus.writesAllowed}
                  className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Seed demo searches
                </button>
              </form>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]/70 p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">
                Seed browser-backed demo
              </div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                Add a ready-to-run operations search that uses Google Jobs, LinkedIn, and Indeed without any tracked URLs. Pair this with the browser search bundle on the Connections page when you want to test the live session-backed collectors.
              </div>
              <form action={seedBrowserDemoSearchAction} className="mt-3">
                <button
                  type="submit"
                  disabled={!mutationStatus.writesAllowed}
                  className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Seed browser demo
                </button>
              </form>
            </div>
            {searches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                No saved searches yet. Add one to begin building your automated ingestion list.
              </div>
            ) : (
              searches.map((search) => (
                <div
                  key={search.id}
                  className="rounded-2xl border border-[var(--border)] bg-white/70 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-lg font-semibold">{search.name}</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {search.keywords}
                      </div>
                    </div>
                    <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium text-[var(--accent)]">
                      {search.isActive ? "Active" : "Paused"}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                    <span>Sources: {formatSources(search.sourcesJson)}</span>
                    <span>Tracked URLs: {trackedUrlCount(search.filtersJson)}</span>
                    <span>Cadence: {cadenceLabel(search.scheduleJson)}</span>
                    <span>
                      Last run:{" "}
                      {search.lastRunAt
                        ? new Date(search.lastRunAt).toLocaleString()
                        : "Never"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <form action={runSavedSearchAction}>
                      <input type="hidden" name="searchId" value={search.id} />
                      <button
                        type="submit"
                        disabled={!mutationStatus.writesAllowed}
                        className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Run now
                      </button>
                    </form>
                    <form action={toggleSavedSearchAction}>
                      <input type="hidden" name="searchId" value={search.id} />
                      <input
                        type="hidden"
                        name="nextState"
                        value={search.isActive ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        disabled={!mutationStatus.writesAllowed}
                        className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {search.isActive ? "Pause" : "Activate"}
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </InfoCard>
      </div>
    </PageFrame>
  );
}
