import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { savedSearches } from "@/lib/db/schema/saved-searches";

export function listSavedSearches() {
  return db.select().from(savedSearches).orderBy(desc(savedSearches.createdAt)).all();
}

export function getSavedSearch(searchId: number) {
  return db.select().from(savedSearches).where(eq(savedSearches.id, searchId)).get();
}

