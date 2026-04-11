import { sql } from "drizzle-orm";

export const timestamps = {
  createdAt: sql`CURRENT_TIMESTAMP`,
  updatedAt: sql`CURRENT_TIMESTAMP`,
};

