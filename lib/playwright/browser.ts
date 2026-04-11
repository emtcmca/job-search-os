import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright-core";

import { inspectBrowserAutomation } from "@/lib/playwright/profile";

const browserExecutableCandidates = {
  chrome: [
    ["LOCALAPPDATA", "Google", "Chrome", "Application", "chrome.exe"],
    ["PROGRAMFILES", "Google", "Chrome", "Application", "chrome.exe"],
    ["PROGRAMFILES(X86)", "Google", "Chrome", "Application", "chrome.exe"],
  ],
  edge: [
    ["LOCALAPPDATA", "Microsoft", "Edge", "Application", "msedge.exe"],
    ["PROGRAMFILES", "Microsoft", "Edge", "Application", "msedge.exe"],
    ["PROGRAMFILES(X86)", "Microsoft", "Edge", "Application", "msedge.exe"],
  ],
} as const;

function resolveBrowserExecutablePath(browserType: "chrome" | "edge") {
  for (const candidate of browserExecutableCandidates[browserType]) {
    const [rootEnv, ...segments] = candidate;
    const root = process.env[rootEnv];
    if (!root) {
      continue;
    }

    const executablePath = path.join(
      /* turbopackIgnore: true */ root,
      ...segments,
    );

    if (fs.existsSync(executablePath)) {
      return executablePath;
    }
  }

  return null;
}

export async function withBrowserPage<T>(input: {
  browserType: string | null;
  browserProfileName: string | null;
  connectionMode?: string | null;
  debugPort?: number | null;
  handler: (page: import("playwright-core").Page) => Promise<T>;
}) {
  const inspection = inspectBrowserAutomation({
    isEnabled: true,
    browserType: input.browserType,
    browserProfileName: input.browserProfileName,
    bypassEnabledCheck: true,
  });

  if (inspection.status !== "ready" || !inspection.browserType) {
    throw new Error(inspection.message);
  }

  if (inspection.browserType !== "chrome" && inspection.browserType !== "edge") {
    throw new Error(`${inspection.browserType} is not supported for browser automation.`);
  }

  if (input.connectionMode === "attach") {
    const debugPort = input.debugPort ?? 9222;
    let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null;
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown browser attach error.";
      throw new Error(
        `Could not attach to a running ${inspection.browserType} session on port ${debugPort}. Start Chrome or Edge with remote debugging enabled for the Job Search OS profile, then try again. ${message}`,
      );
    }

    try {
      const context = browser.contexts()[0];
      if (!context) {
        throw new Error(
          `A browser was found on port ${debugPort}, but no automation context was available to inspect.`,
        );
      }

      const page = await context.newPage();
      return await input.handler(page);
    } finally {
      await browser.close();
    }
  }

  const executablePath = resolveBrowserExecutablePath(inspection.browserType);
  if (!executablePath) {
    throw new Error(`Could not find a local ${inspection.browserType} executable for browser automation.`);
  }

  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null = null;
  try {
    context = await chromium.launchPersistentContext(inspection.resolvedRootPath!, {
      executablePath,
      headless: true,
      viewport: { width: 1440, height: 1100 },
      args: [
        `--profile-directory=${inspection.resolvedProfileDirectory ?? inspection.requestedProfileName ?? "Default"}`,
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown browser launch error.";
    throw new Error(
      `Could not launch ${inspection.browserType} with profile "${inspection.requestedProfileName}". If that profile is already open in Chrome or Edge, close those windows first and try again. ${message}`,
    );
  }

  try {
    const existingPage = context.pages()[0];
    const page = existingPage ?? (await context.newPage());
    return await input.handler(page);
  } finally {
    await context.close();
  }
}
