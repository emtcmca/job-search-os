import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { listCandidateProfiles } from "@/lib/jobs/queries";

export default async function CandidateProfilePage() {
  await ensureDefaultRecords();
  const profiles = await listCandidateProfiles();

  return (
    <PageFrame
      eyebrow="Candidate Profile"
      title="One canonical source of truth, multiple strategic variants."
      description="This section will normalize your resume and profile materials into reusable factual building blocks for operations, consulting, workflow/AI, and freelance positioning."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard
          title="Canonical profile"
          body="Master experience, achievements, role history, and validated claims will be centralized here so future drafts stay consistent."
        />
        <InfoCard
          title="Role variants"
          body="Variant overlays will let the tailoring engine emphasize the right lane without drifting away from the source facts."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {profiles.map((profile) => {
          const content = JSON.parse(profile.contentJson) as {
            headline: string;
            summary: string;
            targetTitles: string[];
            strengths: string[];
          };

          return (
            <InfoCard key={profile.id} title={profile.name} body={content.summary}>
              <div className="space-y-3 text-sm text-[var(--muted)]">
                <div>
                  <span className="font-medium text-[var(--foreground)]">Headline:</span>{" "}
                  {content.headline}
                </div>
                <div>
                  <span className="font-medium text-[var(--foreground)]">Variant:</span>{" "}
                  {profile.profileType}
                  {profile.isCanonical ? " · canonical source of truth" : ""}
                </div>
                <div>
                  <span className="font-medium text-[var(--foreground)]">Target titles:</span>{" "}
                  {content.targetTitles.join(", ")}
                </div>
                <div>
                  <span className="font-medium text-[var(--foreground)]">Core strengths:</span>{" "}
                  {content.strengths.join(", ")}
                </div>
                <div className="break-all rounded-xl border border-[var(--border)] bg-white/70 px-3 py-2 text-xs">
                  {profile.sourceDocPath}
                </div>
              </div>
            </InfoCard>
          );
        })}
      </div>
    </PageFrame>
  );
}
