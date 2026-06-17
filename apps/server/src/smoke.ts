import { tmpdir } from "node:os";
import { join } from "node:path";

const databasePath = join(tmpdir(), `tooltrace-api-smoke-${Date.now()}.db`);
process.env.TOOLTRACE_DB_PATH = databasePath;

const { createApp } = await import("./app.js");
const { initializeDatabase } = await import("./storage.js");

initializeDatabase(databasePath);

const app = createApp();
const runId = `run_${Date.now()}`;
const metadataRunId = `run_metadata_${Date.now()}`;
const eventId = `evt_${Date.now()}`;
const metadataEventId = `evt_metadata_${Date.now()}`;

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

const createMetadataRunResponse = await app.request("/runs", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: metadataRunId,
    name: "codex-agent",
    status: "running",
    input: { task: "metadata smoke test" },
    metadata: {
      agent: "codex",
      surface: "cli",
      sessionId: "session_smoke",
      turnId: "turn_smoke",
      redactionLevel: "metadata"
    }
  })
});

if (createMetadataRunResponse.status !== 201) {
  throw new Error(
    `Expected metadata run creation to return 201, got ${createMetadataRunResponse.status}`
  );
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
    durationMs: 42,
    metadata: {
      agent: "codex",
      surface: "cli",
      sessionId: "session_smoke",
      turnId: "turn_smoke",
      toolUseId: "tool_smoke",
      hookEvent: "PostToolUse",
      redactionLevel: "metadata"
    }
  })
});

if (createEventResponse.status !== 201) {
  throw new Error(`Expected event creation to return 201, got ${createEventResponse.status}`);
}

const createMetadataEventResponse = await app.request("/events", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: metadataEventId,
    runId: metadataRunId,
    type: "tool_call",
    name: "Bash",
    status: "success",
    durationMs: 24,
    metadata: {
      agent: "codex",
      surface: "cli",
      sessionId: "session_smoke",
      turnId: "turn_smoke",
      toolUseId: "tool_smoke_2",
      hookEvent: "PostToolUse",
      redactionLevel: "metadata"
    }
  })
});

if (createMetadataEventResponse.status !== 201) {
  throw new Error(
    `Expected metadata event creation to return 201, got ${createMetadataEventResponse.status}`
  );
}

const runsResponse = await app.request("/runs");
const runs = await runsResponse.json();

if (!Array.isArray(runs) || !runs.some((run) => run.id === runId)) {
  throw new Error("Expected /runs to return the smoke run.");
}

const metadataRun = Array.isArray(runs) ? runs.find((run) => run.id === metadataRunId) : undefined;

if (metadataRun?.metadata?.agent !== "codex") {
  throw new Error("Expected /runs to return metadata for the agent run.");
}

const oldPayloadRun = Array.isArray(runs) ? runs.find((run) => run.id === runId) : undefined;

if (oldPayloadRun?.metadata !== undefined) {
  throw new Error("Expected old run payload without metadata to remain valid.");
}

const eventsResponse = await app.request(`/runs/${runId}/events`);
const events = await eventsResponse.json();

if (!Array.isArray(events) || events[0]?.id !== eventId) {
  throw new Error("Expected /runs/:id/events to return the smoke event.");
}

if (events[0]?.metadata?.toolUseId !== "tool_smoke") {
  throw new Error("Expected /runs/:id/events to return event metadata.");
}

const metadataEventsResponse = await app.request(`/runs/${metadataRunId}/events`);
const metadataEvents = await metadataEventsResponse.json();

if (!Array.isArray(metadataEvents) || metadataEvents[0]?.id !== metadataEventId) {
  throw new Error("Expected /runs/:id/events to return the metadata smoke event.");
}

console.log("ToolTrace API smoke test passed.");
