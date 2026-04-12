import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { savedSearches } from "@/lib/db/schema/saved-searches";

export type SavedSearchRecord = typeof savedSearches.$inferSelect;

export async function listSavedSearches() {
  return (await db
    .select()
    .from(savedSearches)
    .orderBy(desc(savedSearches.createdAt))
    .all()) as SavedSearchRecord[];
}

export async function getSavedSearch(searchId: number) {
  return (await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.id, searchId))
    .get()) as SavedSearchRecord | undefined;
}
