import { NextResponse } from "next/server";

import { beginGmailAuthorization } from "@/lib/inbox/connection-store";
import { getGmailSetupStatus } from "@/lib/inbox/gmail";

const inboxSettingsUrl = "/settings/inbox";

export async function GET() {
  const result = await beginGmailAuthorization();
  if (!result.ok) {
    const setup = getGmailSetupStatus();
    return NextResponse.redirect(
      new URL(
        `${inboxSettingsUrl}?status=error&message=${encodeURIComponent(
          result.message,
        )}`,
        setup.callbackUrl,
      ),
    );
  }

  return NextResponse.redirect(result.authUrl);
}
