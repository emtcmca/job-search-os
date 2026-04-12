import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";

type FreelanceDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FreelanceDetailPage({
  params,
}: FreelanceDetailPageProps) {
  const { id } = await params;

  return (
    <PageFrame
      eyebrow="Proposal Detail"
      title={`Freelance Lead ${id}`}
      description="Proposal drafts, client-fit reasoning, and follow-up actions will live here with a separate action model from the full-time job pipeline."
    >
      <InfoCard
        title="Planned behavior"
        body="This page will support both responding to opportunities and creating recommended service listings for your own freelance offerings."
      />
    </PageFrame>
  );
}

