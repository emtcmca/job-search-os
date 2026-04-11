import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";

export default function FreelancePage() {
  return (
    <PageFrame
      eyebrow="Freelance Pipeline"
      title="Keep proposals and service listings in their own lane."
      description="Upwork and Fiverr opportunities will be managed separately from salaried roles, with their own scoring, proposal drafting, and Linear project mapping."
    >
      <InfoCard
        title="Freelance scope"
        body="This pipeline will cover lead ingestion, proposal generation, follow-ups, and AI-assisted listing creation for your own offerings."
      />
    </PageFrame>
  );
}

