import { tmpdir } from "node:os";
import { join } from "node:path";

const databasePath = join(tmpdir(), `tooltrace-api-smoke-${Date.now()}.db`);
process.env.TOOLTRACE_DB_PATH = databasePath;

const { createApp } = await import("./app.js");
const { initializeDatabase } = await import("./storage.js");

initializeDatabase(databasePath);

const app = createApp();
const runId = `run_${Date.now()}`;
const eventId = `evt_${Date.now()}`;

const createRunResponse = await app.request("/runs", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: runId,
    name: "smoke-agent",
    status: "running",
    input: { task: "smoke test" }
  })
});

if (createRunResponse.status !== 201) {
  throw new Error(`Expected run creation to return 201, got ${createRunResponse.status}`);
}

const createEventResponse = await app.request("/events", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: eventId,
    runId,
    type: "tool_call",
    name: "web_search",
    status: "success",
    input: { query: "MCP ecosystem" },
    output: { results: 1 },
    durationMs: 42
  })
});

if (createEventResponse.status !== 201) {
  throw new Error(`Expected event creation to return 201, got ${createEventResponse.status}`);
}

const runsResponse = await app.request("/runs");
const runs = await runsResponse.json();

if (!Array.isArray(runs) || runs[0]?.id !== runId) {
  throw new Error("Expected /runs to return the smoke run.");
}

const eventsResponse = await app.request(`/runs/${runId}/events`);
const events = await eventsResponse.json();

if (!Array.isArray(events) || events[0]?.id !== eventId) {
  throw new Error("Expected /runs/:id/events to return the smoke event.");
}

console.log("ToolTrace API smoke test passed.");
