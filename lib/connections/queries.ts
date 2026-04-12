import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { platformConnections } from "@/lib/db/schema/integrations";

export type PlatformConnectionRecord = typeof platformConnections.$inferSelect;

export async function listPlatformConnections() {
  return (await db
    .select()
    .from(platformConnections)
    .orderBy(asc(platformConnections.platform))
    .all()) as PlatformConnectionRecord[];
}

export async function getPlatformConnection(platform: string) {
  return (await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.platform, platform))
    .get()) as PlatformConnectionRecord | undefined;
}
