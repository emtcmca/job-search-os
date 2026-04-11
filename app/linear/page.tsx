import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";

export default function LinearPage() {
  return (
    <PageFrame
      eyebrow="Linear Vault"
      title="Send action items to Linear, keep raw job data in the app."
      description="The Linear integration will focus on actionable work for the Job Search team, with separate Full-Time and Freelance projects and standardized issue templates."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard
          title="What syncs"
          body="Lead review tasks, tailoring work, follow-ups, interview prep, and research issues should sync. Raw scraped records should not."
        />
        <InfoCard
          title="What stays local"
          body="Job snapshots, detailed scoring, generated files, and AI usage history remain in the local application database and filesystem."
        />
      </div>
    </PageFrame>
  );
}

