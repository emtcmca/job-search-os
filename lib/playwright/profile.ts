import fs from "node:fs";
import path from "node:path";

export const supportedBrowserTypes = ["chrome", "edge"] as const;

type SupportedBrowserType = (typeof supportedBrowserTypes)[number];

type BrowserProfileMatch = {
  directory: string;
  name: string;
};

export type BrowserAutomationInspection = {
  status:
    | "disabled"
    | "incomplete"
    | "unsupported_browser"
    | "missing_browser_data"
    | "missing_profile"
    | "ready";
  message: string;
  browserType: string | null;
  requestedProfileName: string | null;
  detectedProfiles: BrowserProfileMatch[];
  resolvedRootPath: string | null;
  resolvedProfileDirectory: string | null;
  resolvedProfilePath: string | null;
};

type BrowserLocalState = {
  profile?: {
    info_cache?: Record<
      string,
      {
        name?: string;
      }
    >;
  };
};

function isSupportedBrowserType(value: string | null): value is SupportedBrowserType {
  return Boolean(value) && supportedBrowserTypes.includes(value as SupportedBrowserType);
}

function getBrowserUserDataRoot(browserType: SupportedBrowserType) {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return null;
  }

  if (browserType === "chrome") {
    return path.join(
      /* turbopackIgnore: true */ localAppData,
      "Google",
      "Chrome",
      "User Data",
    );
  }

  return path.join(
    /* turbopackIgnore: true */ localAppData,
    "Microsoft",
    "Edge",
    "User Data",
  );
}

function readBrowserLocalState(browserType: SupportedBrowserType) {
  const rootPath = getBrowserUserDataRoot(browserType);
  if (!rootPath) {
    return null;
  }

  const localStatePath = path.join(rootPath, "Local State");
  if (!fs.existsSync(localStatePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(localStatePath, "utf8")) as BrowserLocalState;
  } catch {
    return null;
  }
}

export function listDetectedBrowserProfiles(browserType: string | null) {
  if (!isSupportedBrowserType(browserType)) {
    return [];
  }

  const localState = readBrowserLocalState(browserType);
  const infoCache = localState?.profile?.info_cache ?? {};

  return Object.entries(infoCache)
    .map(([directory, profile]) => ({
      directory,
      name: profile.name?.trim() || directory,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function inspectBrowserAutomation(input: {
  isEnabled: boolean;
  browserType: string | null;
  browserProfileName: string | null;
  bypassEnabledCheck?: boolean;
}): BrowserAutomationInspection {
  if (!input.isEnabled && !input.bypassEnabledCheck) {
    return {
      status: "disabled",
      message: "This platform connection is disabled.",
      browserType: input.browserType,
      requestedProfileName: input.browserProfileName,
      detectedProfiles: [],
      resolvedRootPath: null,
      resolvedProfileDirectory: null,
      resolvedProfilePath: null,
    };
  }

  if (!input.browserType || !input.browserProfileName) {
    return {
      status: "incomplete",
      message: "Add a browser type and profile name before browser-assisted automation can use this source.",
      browserType: input.browserType,
      requestedProfileName: input.browserProfileName,
      detectedProfiles: [],
      resolvedRootPath: null,
      resolvedProfileDirectory: null,
      resolvedProfilePath: null,
    };
  }

  if (!isSupportedBrowserType(input.browserType)) {
    return {
      status: "unsupported_browser",
      message: `${input.browserType} is not supported yet for browser-assisted automation.`,
      browserType: input.browserType,
      requestedProfileName: input.browserProfileName,
      detectedProfiles: [],
      resolvedRootPath: null,
      resolvedProfileDirectory: null,
      resolvedProfilePath: null,
    };
  }

  const resolvedRootPath = getBrowserUserDataRoot(input.browserType);
  if (!resolvedRootPath || !fs.existsSync(resolvedRootPath)) {
    return {
      status: "missing_browser_data",
      message: `Could not find the ${input.browserType} browser data folder on this machine yet.`,
      browserType: input.browserType,
      requestedProfileName: input.browserProfileName,
      detectedProfiles: [],
      resolvedRootPath,
      resolvedProfileDirectory: null,
      resolvedProfilePath: null,
    };
  }

  const detectedProfiles = listDetectedBrowserProfiles(input.browserType);
  const requestedProfileName = input.browserProfileName.trim();
  const normalizedRequestedProfileName = requestedProfileName.toLowerCase();
  const matchedProfile =
    detectedProfiles.find(
      (profile) =>
        profile.name.toLowerCase() === normalizedRequestedProfileName ||
        profile.directory.toLowerCase() === normalizedRequestedProfileName,
    ) ?? null;

  if (!matchedProfile) {
    const fallbackPath = path.join(resolvedRootPath, requestedProfileName);
    if (fs.existsSync(fallbackPath)) {
      return {
        status: "ready",
        message: `The requested profile path exists and is ready for ${input.browserType}-based automation.`,
        browserType: input.browserType,
        requestedProfileName,
        detectedProfiles,
        resolvedRootPath,
        resolvedProfileDirectory: requestedProfileName,
        resolvedProfilePath: fallbackPath,
      };
    }

    return {
      status: "missing_profile",
      message:
        detectedProfiles.length > 0
          ? `Could not find a ${input.browserType} profile named "${requestedProfileName}".`
          : `No ${input.browserType} profiles were detected in the local browser data yet.`,
      browserType: input.browserType,
      requestedProfileName,
      detectedProfiles,
      resolvedRootPath,
      resolvedProfileDirectory: null,
      resolvedProfilePath: null,
    };
  }

  const resolvedProfilePath = path.join(resolvedRootPath, matchedProfile.directory);
  if (!fs.existsSync(resolvedProfilePath)) {
    return {
      status: "missing_profile",
      message: `The ${input.browserType} profile "${matchedProfile.name}" was found in browser metadata but its folder is missing on disk.`,
      browserType: input.browserType,
      requestedProfileName,
      detectedProfiles,
      resolvedRootPath,
      resolvedProfileDirectory: matchedProfile.directory,
      resolvedProfilePath,
    };
  }

  return {
    status: "ready",
    message: `Using ${input.browserType} profile "${matchedProfile.name}" for browser-assisted automation prep.`,
    browserType: input.browserType,
    requestedProfileName,
    detectedProfiles,
    resolvedRootPath,
    resolvedProfileDirectory: matchedProfile.directory,
    resolvedProfilePath,
  };
}

export function browserAutomationStatus(input: {
  isEnabled: boolean;
  browserType: string | null;
  browserProfileName: string | null;
}) {
  return inspectBrowserAutomation(input).status;
}
