export type CandidateProfileSeed = {
  name: string;
  profileType: "canonical" | "operations" | "consulting" | "workflow_ai_ops" | "freelance";
  sourceDocPath: string;
  isCanonical: boolean;
  content: {
    headline: string;
    summary: string;
    targetTitles: string[];
    strengths: string[];
    preferredWork: {
      remote: boolean;
      hybrid: boolean;
      onSiteArea: string;
      salaryFloorUsd: number;
    };
  };
};

export const defaultCandidateProfiles: CandidateProfileSeed[] = [
  {
    name: "Eric Tetzlaff Master Profile",
    profileType: "canonical",
    sourceDocPath:
      "C:/Users/tetzl/OneDrive/Documents/Resume Info/docx_output/Eric_Tetzlaff_Resume_Master.docx",
    isCanonical: true,
    content: {
      headline: "Founder-operator, workflow architect, and operations leader",
      summary:
        "Builder with 14+ years of experience scaling service organizations, redesigning workflows, leading teams, and implementing AI-enabled operational systems.",
      targetTitles: [
        "Operations Manager",
        "Director of Operations",
        "Business Operations Manager",
        "Program Manager",
        "Implementation Manager",
        "Workflow Consultant",
        "AI Operations Specialist",
      ],
      strengths: [
        "Operations leadership",
        "Workflow design",
        "Process improvement",
        "AI-enabled automation",
        "Systems implementation",
        "Team leadership",
        "Change management",
        "Budget oversight",
      ],
      preferredWork: {
        remote: true,
        hybrid: true,
        onSiteArea: "Greater Cleveland, OH",
        salaryFloorUsd: 80000,
      },
    },
  },
  {
    name: "Operations Variant",
    profileType: "operations",
    sourceDocPath:
      "C:/Users/tetzl/OneDrive/Documents/Resume Info/docx_output/Eric_Tetzlaff_Resume_Operations.docx",
    isCanonical: false,
    content: {
      headline: "Operations leader and founder-operator",
      summary:
        "Hands-on operations leader experienced in service delivery, team management, systems migration, SOP development, and client retention.",
      targetTitles: [
        "Operations Manager",
        "Director of Operations",
        "Service Delivery Manager",
        "Business Operations Manager",
      ],
      strengths: [
        "Operations management",
        "Hiring and training",
        "Vendor management",
        "Service delivery",
        "Client retention",
        "Systems migration",
      ],
      preferredWork: {
        remote: true,
        hybrid: true,
        onSiteArea: "Greater Cleveland, OH",
        salaryFloorUsd: 80000,
      },
    },
  },
  {
    name: "Consulting Variant",
    profileType: "consulting",
    sourceDocPath:
      "C:/Users/tetzl/OneDrive/Documents/Resume Info/docx_output/Eric_Tetzlaff_Resume_Consulting.docx",
    isCanonical: false,
    content: {
      headline: "Workflow architect and consulting-oriented operator",
      summary:
        "Consulting-focused profile emphasizing workflow redesign, knowledge systems, document intelligence, and AI-assisted operational improvement.",
      targetTitles: [
        "Operations Consultant",
        "Process Improvement Consultant",
        "Workflow Consultant",
        "Business Systems Consultant",
      ],
      strengths: [
        "Knowledge systems",
        "Document workflows",
        "Automation planning",
        "Operational strategy",
        "Client-facing delivery",
      ],
      preferredWork: {
        remote: true,
        hybrid: true,
        onSiteArea: "Greater Cleveland, OH",
        salaryFloorUsd: 80000,
      },
    },
  },
  {
    name: "Workflow AI Ops Variant",
    profileType: "workflow_ai_ops",
    sourceDocPath:
      "C:/Users/tetzl/OneDrive/Documents/Resume Info/docx_output/Eric_Tetzlaff_Resume_Workflow_AI_Ops.docx",
    isCanonical: false,
    content: {
      headline: "Workflow and AI-enabled operations specialist",
      summary:
        "Profile tuned for roles spanning AI-enabled operations, workflow automation, process redesign, and systems implementation.",
      targetTitles: [
        "AI Operations Specialist",
        "Workflow Automation Manager",
        "Solutions Architect",
        "Implementation Specialist",
      ],
      strengths: [
        "Workflow automation",
        "Process redesign",
        "PowerShell",
        "Python",
        "OCR and document ingestion",
        "AI orchestration",
      ],
      preferredWork: {
        remote: true,
        hybrid: true,
        onSiteArea: "Greater Cleveland, OH",
        salaryFloorUsd: 80000,
      },
    },
  },
  {
    name: "Freelance Services Variant",
    profileType: "freelance",
    sourceDocPath:
      "C:/Users/tetzl/OneDrive/Documents/Resume Info/docx_output/Eric_Tetzlaff_Fiverr_Profile_Copy.docx",
    isCanonical: false,
    content: {
      headline: "Workflow, operations, and AI-enabled business process consultant",
      summary:
        "Freelance positioning focused on workflow audits, SOP creation, operations cleanup, knowledge base design, and AI-enabled workflow planning.",
      targetTitles: [
        "Operations Consultant",
        "Workflow Consultant",
        "SOP Consultant",
        "AI Workflow Planner",
      ],
      strengths: [
        "Workflow audits",
        "SOP documentation",
        "Operations cleanup",
        "Knowledge base design",
        "AI-enabled workflow planning",
      ],
      preferredWork: {
        remote: true,
        hybrid: true,
        onSiteArea: "Greater Cleveland, OH",
        salaryFloorUsd: 80000,
      },
    },
  },
];
