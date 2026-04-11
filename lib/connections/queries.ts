import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { platformConnections } from "@/lib/db/schema/integrations";

export function listPlatformConnections() {
  return db
    .select()
    .from(platformConnections)
    .orderBy(asc(platformConnections.platform))
    .all();
}

export function getPlatformConnection(platform: string) {
  return db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.platform, platform))
    .get();
}
