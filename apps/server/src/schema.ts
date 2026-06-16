import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  inputJson: text("input_json"),
  outputJson: text("output_json"),
  error: text("error")
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  type: text("type").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  timestamp: text("timestamp").notNull(),
  durationMs: integer("duration_ms"),
  inputJson: text("input_json"),
  outputJson: text("output_json"),
  errorJson: text("error_json"),
  metadataJson: text("metadata_json")
});
