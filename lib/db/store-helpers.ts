import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";

export async function selectFirstByColumnAsync(
  table: any,
  column: any,
  value: unknown,
) {
  return await db.select().from(table).where(eq(column, value as never)).get();
}

export async function selectFirstWithBuilderAsync(
  builder: (database: typeof db) => any,
) {
  return (await builder(db).get()) as unknown;
}

export async function selectAllWithBuilderAsync(builder: (database: typeof db) => any) {
  return (await builder(db).all()) as unknown;
}

export async function insertRecordAsync(table: any, values: unknown) {
  await db.insert(table).values(values as never).run();
}

export async function insertRecordReturningAsync(
  table: any,
  values: unknown,
  returning: unknown,
) {
  return (await db
    .insert(table)
    .values(values as never)
    .returning(returning as never)
    .get()) as unknown;
}

export async function updateRecordByColumnAsync(
  table: any,
  column: any,
  value: unknown,
  values: unknown,
) {
  await db
    .update(table)
    .set(values as never)
    .where(eq(column, value as never))
    .run();
}

export async function updateRecordWhereAsync(
  table: any,
  whereClause: any,
  values: unknown,
) {
  await db.update(table).set(values as never).where(whereClause).run();
}
