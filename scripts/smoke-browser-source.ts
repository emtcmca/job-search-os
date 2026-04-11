import { collectBrowserSourceCandidates } from "@/lib/browser-sources/collect";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getPlatformConnection } from "@/lib/connections/queries";

type SupportedSource = "google_jobs" | "linkedin" | "indeed";

function parseSource(value: string | undefined): SupportedSource {
  if (value === "google_jobs" || value === "linkedin" || value === "indeed") {
    return value;
  }

  return "google_jobs";
}

function parseOptionalFlag(flag: string, values: string[]) {
  const index = values.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const nextValue = values[index + 1];
  return nextValue ?? null;
}

async function main() {
  await ensureDefaultRecords();

  const args = process.argv.slice(2);
  const source = parseSource(args[0]);
  const attachFlag = args.includes("--attach");
  const debugPortValue = parseOptionalFlag("--port", args);
  const nonFlagArgs = args.slice(1).filter((arg, index, list) => {
    if (arg === "--attach" || arg === "--port") {
      return false;
    }

    const previous = list[index - 1];
    if (previous === "--port") {
      return false;
    }

    return true;
  });
  const keywords = nonFlagArgs.join(" ").trim() || "operations manager remote";
  const connection = getPlatformConnection(source);

  if (!connection) {
    throw new Error(`No platform connection found for ${source}.`);
  }

  const candidates = await collectBrowserSourceCandidates({
    source,
    keywords,
    browserType: connection.browserType,
    browserProfileName: connection.browserProfileName,
    connectionMode: attachFlag ? "attach" : connection.connectionMode,
    debugPort:
      debugPortValue && Number.isFinite(Number(debugPortValue))
        ? Number(debugPortValue)
        : connection.debugPort,
  });

  console.log(
    JSON.stringify(
      {
        source,
        keywords,
        connectionMode: attachFlag ? "attach" : connection.connectionMode,
        candidateCount: candidates.length,
        candidates: candidates.slice(0, 5),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
