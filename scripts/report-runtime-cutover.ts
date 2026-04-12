import "./load-env";

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const workspaceRoot = process.cwd();
const scanRoots = ["app", "lib"];
const fileExtensions = new Set([".ts", ".tsx"]);
const dbClientImportPattern = /@\/lib\/db\/client/g;
const dbSyncChainPattern = /(?:db|sqlite)\.[\s\S]{0,800}?\.(get|all|run)\(/g;

type FileInventory = {
  path: string;
  importCount: number;
  syncCallCount: number;
};

async function collectFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
      continue;
    }

    if (!fileExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

function countMatches(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].length;
}

async function scanFile(filePath: string): Promise<FileInventory> {
  const content = await readFile(filePath, "utf8");

  return {
    path: relative(workspaceRoot, filePath),
    importCount: countMatches(content, dbClientImportPattern),
    syncCallCount: countMatches(content, dbSyncChainPattern),
  };
}

async function main() {
  const existingRoots: string[] = [];

  for (const root of scanRoots) {
    const absolutePath = join(workspaceRoot, root);
    try {
      const metadata = await stat(absolutePath);
      if (metadata.isDirectory()) {
        existingRoots.push(absolutePath);
      }
    } catch {
      // Ignore missing roots so the script stays resilient if the app shape changes.
    }
  }

  const files = (
    await Promise.all(existingRoots.map((root) => collectFiles(root)))
  ).flat();
  const inventory = await Promise.all(files.map((filePath) => scanFile(filePath)));

  const dbImporters = inventory.filter((item) => item.importCount > 0);
  const syncCallSites = inventory.filter((item) => item.syncCallCount > 0);
  const totalSyncCalls = syncCallSites.reduce((sum, item) => sum + item.syncCallCount, 0);
  const topSyncFiles = [...syncCallSites]
    .sort((left, right) => right.syncCallCount - left.syncCallCount)
    .slice(0, 10)
    .map((item) => ({
      path: item.path,
      syncCallCount: item.syncCallCount,
      importsDbClient: item.importCount > 0,
    }));

  const output = {
    generatedAt: new Date().toISOString(),
    scannedRoots: scanRoots,
    totals: {
      filesScanned: inventory.length,
      dbClientImporters: dbImporters.length,
      syncCallSites: syncCallSites.length,
      totalSyncCalls,
    },
    topSyncFiles,
    recommendedSequence: [
      "Convert shared read/query helpers in lib/jobs, lib/inbox, and lib/searches to async-first interfaces.",
      "Refactor server actions and route handlers that depend on those helpers to await query and mutation results.",
      "Keep browser-backed collectors local-only on hosted runtimes, even after durable hosted reads are enabled.",
      "Finish migrating write-heavy workflow stores so hosted mutations can be enabled on top of the new env-gated db client.",
    ],
  };

  console.log(JSON.stringify(output, null, 2));
}

void main();
