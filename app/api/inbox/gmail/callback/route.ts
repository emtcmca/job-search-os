import { NextRequest, NextResponse } from "next/server";

import { finalizeGmailAuthorization } from "@/lib/inbox/connection-store";
import { getGmailSetupStatus } from "@/lib/inbox/gmail";

const inboxSettingsUrl = "/settings/inbox";

function buildSettingsRedirect(message: string, status: "success" | "error") {
  const setup = getGmailSetupStatus();
  return new URL(
    `${inboxSettingsUrl}?status=${status}&message=${encodeURIComponent(message)}`,
    setup.callbackUrl,
  );
}

export async function GET(request: NextRequest) {
  const result = await finalizeGmailAuthorization({
    code: request.nextUrl.searchParams.get("code"),
    state: request.nextUrl.searchParams.get("state"),
    error: request.nextUrl.searchParams.get("error"),
  });

  return NextResponse.redirect(
    buildSettingsRedirect(result.message, result.ok ? "success" : "error"),
  );
}
