import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { listGeneratedDocuments } from "@/lib/jobs/queries";

export default async function DocumentsPage() {
  await ensureDefaultRecords();
  const documents = listGeneratedDocuments();

  return (
    <PageFrame
      eyebrow="Artifacts"
      title="Store the output, not just the prompt."
      description="Generated resumes, cover letters, proposals, and job snapshots will be stored with metadata, provenance, and version history."
    >
      <InfoCard
        title="Storage model"
        body="The app keeps both database metadata and local files on disk so generated materials stay portable and auditable."
      >
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
              No generated documents yet.
            </div>
          ) : (
            documents.map((document) => (
              <div
                key={document.id}
                className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
              >
                <div className="font-medium text-[var(--foreground)]">
                  {document.documentType.replaceAll("_", " ")} v{document.version}
                </div>
                <div className="mt-1 text-[var(--muted)]">{document.filePath}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Approval state: {document.approvalState}
                </div>
              </div>
            ))
          )}
        </div>
      </InfoCard>
    </PageFrame>
  );
}
