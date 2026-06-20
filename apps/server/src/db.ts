import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

export const defaultDatabasePath = "agent-trace.db";

export function getDatabasePath() {
  return process.env.AGENT_TRACE_DB_PATH ?? process.env.TOOLTRACE_DB_PATH ?? defaultDatabasePath;
}

export function createSqliteDatabase(path = getDatabasePath()): Database.Database {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return sqlite;
}

export function createDb(path = getDatabasePath()) {
  return drizzle(createSqliteDatabase(path));
}

export const db = createDb();
