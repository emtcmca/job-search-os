import { collectStructuredBoardCandidates } from "@/lib/searches/boards";
import { importJob } from "@/lib/jobs/import-job";

type ParsedArgs = {
  keywords: string[];
  urls: string[];
  shouldImport: boolean;
  strictKeywordMatch: boolean;
  limit: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  const keywords: string[] = [];
  const urls: string[] = [];
  let shouldImport = false;
  let strictKeywordMatch = true;
  let limit = 5;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--import") {
      shouldImport = true;
      continue;
    }

    if (current === "--loose") {
      strictKeywordMatch = false;
      continue;
    }

    if (current === "--limit") {
      const next = Number(argv[index + 1]);
      if (Number.isFinite(next) && next > 0) {
        limit = next;
        index += 1;
      }
      continue;
    }

    if (current === "--keyword" || current === "--keywords") {
      const next = argv[index + 1];
      if (next) {
        keywords.push(next);
        index += 1;
      }
      continue;
    }

    urls.push(current);
  }

  return {
    keywords,
    urls,
    shouldImport,
    strictKeywordMatch,
    limit,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.urls.length === 0) {
    throw new Error(
      "Provide at least one Greenhouse, Lever, or Workday board URL. Example: tsx scripts/smoke-ats-boards.ts --keyword software https://boards.greenhouse.io/speechify https://jobs.lever.co/happyco https://workday.wd5.myworkdayjobs.com/en-US/Workday",
    );
  }

  const results = [];

  for (const url of args.urls) {
    const candidates =
      (await collectStructuredBoardCandidates({
        trackedUrl: url,
        keywords: args.keywords.map((keyword) => keyword.toLowerCase()),
        strictKeywordMatch: args.strictKeywordMatch,
      })) ?? [];

    const selected = candidates.slice(0, args.limit);
    const imports = [];

    if (args.shouldImport) {
      for (const candidate of selected) {
        imports.push(
          await importJob({
            url: candidate.url,
            manualTitle: candidate.title,
            manualCompany: candidate.company ?? undefined,
            manualLocation: candidate.location ?? undefined,
            rawDescription: candidate.rawDescription ?? candidate.snippet ?? undefined,
          }),
        );
      }
    }

    results.push({
      boardUrl: url,
      totalCandidates: candidates.length,
      sampledCandidates: selected.map((candidate) => ({
        source: candidate.source,
        url: candidate.url,
        title: candidate.title,
        company: candidate.company,
        location: candidate.location,
      })),
      imports,
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
