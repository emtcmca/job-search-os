import Link from "next/link";

import {
  buildServiceListingAction,
  createFreelanceLeadAction,
  createFreelanceProfileAction,
  discoverFreelanceNichesAction,
  importClaudeStorageAction,
  updateFreelanceNicheAction,
  updateFreelanceProfileAction,
  updateServiceListingAction,
} from "@/app/freelance/actions";
import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { safeJsonParse, stringifyPretty } from "@/lib/freelance/json";
import {
  getFreelanceDashboard,
  parseFreelanceProfileMemory,
} from "@/lib/freelance/queries";
import { freelancePlatforms } from "@/lib/freelance/platforms";
import { getHostedPreviewMutationStatus } from "@/lib/runtime/deployment";

type FreelancePageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

const nicheStatuses = ["candidate", "saved", "paused", "retired"];
const listingStatuses = ["active", "paused", "retired"];

function badgeClass(status: string) {
  if (["won", "active", "saved", "ready"].includes(status)) {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }

  if (["closed", "retired", "paused"].includes(status)) {
    return "border-stone-300 bg-stone-50 text-stone-700";
  }

  if (["tailoring", "submitted", "interview"].includes(status)) {
    return "border-blue-300 bg-blue-50 text-blue-900";
  }

  return "border-amber-300 bg-amber-50 text-amber-900";
}

function renderContentPreview(raw: string) {
  const content = safeJsonParse<Record<string, unknown>>(raw, {});
  const title =
    typeof content.catalogTitle === "string"
      ? content.catalogTitle
      : typeof content.gigTitle === "string"
        ? content.gigTitle
        : typeof content.listingTitle === "string"
          ? content.listingTitle
          : "Untitled listing";

  const text =
    typeof content.fullDescription === "string"
      ? content.fullDescription
      : typeof content.description === "string"
        ? content.description
        : typeof content.overview === "string"
          ? content.overview
          : stringifyPretty(content);

  return { title, text };
}

export default async function FreelancePage({ searchParams }: FreelancePageProps) {
  await ensureDefaultRecords();
  const params = searchParams ? await searchParams : undefined;
  const dashboard = await getFreelanceDashboard();
  const mutationStatus = getHostedPreviewMutationStatus();
  const defaultProfile = dashboard.defaultProfile;
  const memory = defaultProfile ? parseFreelanceProfileMemory(defaultProfile) : null;

  return (
    <PageFrame
      eyebrow="Freelance Pipeline"
      title="Freelance leads, niches, proposals, and service listings."
      description="Phase 1 keeps marketplace work separate from salaried roles while sharing guarded AI usage and local-first persistence."
      metrics={[
        {
          label: "Leads",
          value: String(dashboard.leads.length),
          hint: "Freelance opportunities tracked separately from full-time roles.",
        },
        {
          label: "Niches",
          value: String(dashboard.niches.length),
          hint: "Candidate and saved service areas generated from positioning memory.",
        },
        {
          label: "Listings",
          value: String(dashboard.listings.length),
          hint: "Platform-specific service copy with version history.",
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
          {params.message}
        </div>
      ) : null}

      {mutationStatus.readOnlyHostedPreview ? (
        <ReadOnlyNotice message={mutationStatus.message} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <InfoCard
          title="Add freelance lead"
          body="Manual intake for marketplace opportunities. Browser-backed marketplace collection can plug into this same lead model later."
        >
          <form action={createFreelanceLeadAction}>
            <fieldset
              disabled={!mutationStatus.writesAllowed}
              className={`space-y-4 ${!mutationStatus.writesAllowed ? "opacity-60" : ""}`}
            >
              <input
                name="title"
                required
                placeholder="AI workflow audit for operations team"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  name="platform"
                  defaultValue="Upwork"
                  className="rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                >
                  {freelancePlatforms.map((platform) => (
                    <option key={platform}>{platform}</option>
                  ))}
                </select>
                <input
                  name="url"
                  type="url"
                  placeholder="https://..."
                  className="rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                />
              </div>
              <textarea
                name="rawDescription"
                rows={6}
                placeholder="Paste the gig, contract role, or project description."
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
              <textarea
                name="notes"
                rows={2}
                placeholder="Rate, client context, deadline, or manual notes."
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save freelance lead
              </button>
            </fieldset>
          </form>
        </InfoCard>

        <InfoCard
          title="Positioning memory"
          body="Editable source of truth for services, pricing, voice, proof points, and banned claims. The default profile was seeded from the existing freelance candidate variant."
        >
          {defaultProfile && memory ? (
            <form action={updateFreelanceProfileAction}>
              <fieldset
                disabled={!mutationStatus.writesAllowed}
                className={`space-y-4 ${!mutationStatus.writesAllowed ? "opacity-60" : ""}`}
              >
                <input type="hidden" name="profileId" value={defaultProfile.id} />
                <input
                  name="name"
                  defaultValue={defaultProfile.name}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                />
                <label className="block text-sm">
                  <span className="font-medium">Services</span>
                  <textarea
                    name="servicesText"
                    rows={6}
                    defaultValue={memory.services.join("\n")}
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                  />
                </label>
                <div className="grid gap-3 lg:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium">Pricing JSON</span>
                    <textarea
                      name="pricingJson"
                      rows={7}
                      defaultValue={stringifyPretty(memory.pricing)}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">Voice JSON</span>
                    <textarea
                      name="voiceJson"
                      rows={7}
                      defaultValue={stringifyPretty(memory.voice)}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="font-medium">Proof points</span>
                  <textarea
                    name="proofPointsText"
                    rows={5}
                    defaultValue={memory.proofPoints.join("\n")}
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Banned claims</span>
                  <textarea
                    name="bannedClaimsText"
                    rows={5}
                    defaultValue={memory.bannedClaims.join("\n")}
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Platform preferences JSON</span>
                  <textarea
                    name="platformPreferencesJson"
                    rows={4}
                    defaultValue={stringifyPretty(memory.platformPreferences)}
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs"
                  />
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={defaultProfile.notes ?? ""}
                  placeholder="Additional profile notes."
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white"
                >
                  Save memory
                </button>
              </fieldset>
            </form>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
              No freelance profile exists yet.
            </div>
          )}
          <form action={createFreelanceProfileAction} className="mt-4 flex gap-3">
            <input
              name="name"
              placeholder="New profile name"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2"
            />
            <button
              type="submit"
              disabled={!mutationStatus.writesAllowed}
              className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create profile
            </button>
          </form>
        </InfoCard>
      </div>

      <InfoCard
        title="Import Claude storage"
        body="Paste the JSON export from Claude's `window.storage` dump here. The importer preserves freelance leads, niches, service listings, listing versions, and saved posts, and it can be rerun safely."
      >
        <form action={importClaudeStorageAction}>
          <fieldset
            disabled={!mutationStatus.writesAllowed}
            className={`space-y-4 ${!mutationStatus.writesAllowed ? "opacity-60" : ""}`}
          >
            <input type="hidden" name="profileId" value={defaultProfile?.id ?? ""} />
            <textarea
              name="rawDump"
              rows={12}
              placeholder='{"fcc_apps":[],"fcc_niches":[],"fcc_listings":[],"fcc_posts":[]}'
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs"
            />
            <div className="text-sm leading-6 text-[var(--muted)]">
              Expected keys: <code>fcc_apps</code>, <code>fcc_niches</code>,{" "}
              <code>fcc_listings</code>, and <code>fcc_posts</code>. Missing keys are fine.
            </div>
            <button
              type="submit"
              disabled={!mutationStatus.writesAllowed}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import Claude storage
            </button>
          </fieldset>
        </form>
      </InfoCard>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <InfoCard
          title="Freelance leads"
          body="Generate proposals from each lead detail page after the posting is captured."
        >
          <div className="space-y-3">
            {dashboard.leads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                No freelance leads yet.
              </div>
            ) : (
              dashboard.leads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-2xl border border-[var(--border)] bg-white/70 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <Link href={`/freelance/${lead.id}`} className="text-lg font-semibold">
                        {lead.title}
                      </Link>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {lead.source} · {lead.draftCount} proposal draft
                        {lead.draftCount === 1 ? "" : "s"}
                      </div>
                      {lead.score ? (
                        <div className="mt-2 text-sm text-[var(--muted)]">
                          Fit: {lead.score.overallScore ?? "n/a"}/100 · {lead.score.summary}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${badgeClass(
                        lead.currentStage,
                      )}`}
                    >
                      {lead.currentStage}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/freelance/${lead.id}`}
                      className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </InfoCard>

        <InfoCard
          title="Niche search"
          body="Discover platform-ready service areas from the current positioning memory, then generate marketplace-specific service listings."
        >
          <form action={discoverFreelanceNichesAction} className="mb-4">
            <input type="hidden" name="profileId" value={defaultProfile?.id ?? ""} />
            <button
              type="submit"
              disabled={!mutationStatus.writesAllowed || !defaultProfile}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Discover niches
            </button>
          </form>

          <div className="space-y-4">
            {dashboard.niches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                No niches saved yet.
              </div>
            ) : (
              dashboard.niches.map((niche) => {
                const platforms = safeJsonParse<string[]>(niche.platformsJson, []);
                return (
                  <div
                    key={niche.id}
                    className="rounded-2xl border border-[var(--border)] bg-white/70 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-lg font-semibold">{niche.title}</div>
                        <div className="mt-1 text-sm leading-6 text-[var(--muted)]">
                          {niche.rationale}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-medium text-[var(--accent)]">
                            {niche.demand}
                          </span>
                          {platforms.map((platform) => (
                            <span
                              key={platform}
                              className="rounded-full bg-white px-3 py-1 text-[var(--muted)]"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${badgeClass(
                          niche.status,
                        )}`}
                      >
                        {niche.status}
                      </span>
                    </div>
                    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/70 p-3 text-sm leading-6 text-[var(--muted)]">
                      <div>
                        <span className="font-medium text-[var(--foreground)]">Buyer:</span>{" "}
                        {niche.buyer ?? "Not specified"}
                      </div>
                      <div>
                        <span className="font-medium text-[var(--foreground)]">Edge:</span>{" "}
                        {niche.edge ?? "Not specified"}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <form action={updateFreelanceNicheAction} className="space-y-3">
                        <input type="hidden" name="nicheId" value={niche.id} />
                        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                          <select
                            name="status"
                            defaultValue={niche.status}
                            className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                          >
                            {nicheStatuses.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                          <input
                            name="notes"
                            defaultValue={niche.notes ?? ""}
                            placeholder="Niche notes"
                            className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={!mutationStatus.writesAllowed}
                          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save niche
                        </button>
                      </form>
                      <form action={buildServiceListingAction} className="space-y-3">
                        <input type="hidden" name="nicheId" value={niche.id} />
                        <input type="hidden" name="profileId" value={defaultProfile?.id ?? ""} />
                        <div className="flex gap-3">
                          <select
                            name="platform"
                            defaultValue={platforms[0] ?? "Upwork"}
                            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                          >
                            {freelancePlatforms.map((platform) => (
                              <option key={platform}>{platform}</option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            disabled={!mutationStatus.writesAllowed}
                            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Build listing
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </InfoCard>
      </div>

      <InfoCard
        title="Service listing library"
        body="Generated marketplace copy is saved as structured content. Regenerating an existing niche/platform pair creates a version."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {dashboard.listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
              No service listings yet.
            </div>
          ) : (
            dashboard.listings.map((listing) => {
              const preview = renderContentPreview(listing.contentJson);
              return (
                <div
                  key={listing.id}
                  className="rounded-2xl border border-[var(--border)] bg-white/70 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-lg font-semibold">{listing.title}</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {listing.platform} · {listing.niche?.title ?? "No niche"} ·{" "}
                        {listing.versionCount} previous version
                        {listing.versionCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${badgeClass(
                        listing.status,
                      )}`}
                    >
                      {listing.status}
                    </span>
                  </div>
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/70 p-3">
                    <div className="text-sm font-medium">{preview.title}</div>
                    <div className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                      {preview.text}
                    </div>
                  </div>
                  <form action={updateServiceListingAction} className="mt-4 space-y-3">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                      <select
                        name="status"
                        defaultValue={listing.status}
                        className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      >
                        {listingStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                      <input
                        name="notes"
                        defaultValue={listing.notes ?? ""}
                        placeholder="Listing notes"
                        className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <textarea
                      name="performanceJson"
                      rows={4}
                      defaultValue={stringifyPretty(
                        safeJsonParse<Record<string, unknown>>(listing.performanceJson, {}),
                      )}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs"
                    />
                    <button
                      type="submit"
                      disabled={!mutationStatus.writesAllowed}
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save listing metadata
                    </button>
                  </form>
                </div>
              );
            })
          )}
        </div>
      </InfoCard>
    </PageFrame>
  );
}
