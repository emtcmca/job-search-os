import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";

export function selectFirstByColumn(table: any, column: any, value: unknown) {
  return db.select().from(table).where(eq(column, value as never)).get();
}

export async function selectFirstByColumnAsync(table: any, column: any, value: unknown) {
  return selectFirstByColumn(table, column, value);
}

export function selectFirstWithBuilder(builder: (database: typeof db) => any) {
  return builder(db).get() as unknown;
}

export async function selectFirstWithBuilderAsync(
  builder: (database: typeof db) => any,
) {
  return selectFirstWithBuilder(builder);
}

export function selectAllWithBuilder(builder: (database: typeof db) => any) {
  return builder(db).all() as unknown;
}

export async function selectAllWithBuilderAsync(builder: (database: typeof db) => any) {
  return selectAllWithBuilder(builder);
}

export function insertRecord(table: any, values: unknown) {
  db.insert(table).values(values as never).run();
}

export async function insertRecordAsync(table: any, values: unknown) {
  insertRecord(table, values);
}

export function insertRecordReturning(
  table: any,
  values: unknown,
  returning: unknown,
) {
  return db
    .insert(table)
    .values(values as never)
    .returning(returning as never)
    .get() as unknown;
}

export async function insertRecordReturningAsync(
  table: any,
  values: unknown,
  returning: unknown,
) {
  return insertRecordReturning(table, values, returning);
}

export function updateRecordByColumn(
  table: any,
  column: any,
  value: unknown,
  values: unknown,
) {
  db
    .update(table)
    .set(values as never)
    .where(eq(column, value as never))
    .run();
}

export async function updateRecordByColumnAsync(
  table: any,
  column: any,
  value: unknown,
  values: unknown,
) {
  updateRecordByColumn(table, column, value, values);
}

export function updateRecordWhere(table: any, whereClause: any, values: unknown) {
  db.update(table).set(values as never).where(whereClause).run();
}

export async function updateRecordWhereAsync(
  table: any,
  whereClause: any,
  values: unknown,
) {
  updateRecordWhere(table, whereClause, values);
}
