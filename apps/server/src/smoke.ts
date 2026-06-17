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

const codexSessionId = "codex_session_smoke";
const codexRunId = "run_codex_codex_session_smoke";
const codexSecretPrompt = "please inspect the private billing token";
const codexSecretCommand = "cat .env";

await expectAccepted(
  app.request("/integrations/codex/hook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: codexSessionId,
      hook_event_name: "SessionStart",
      cwd: "/workspace/tooltrace",
      model: "gpt-5.4",
      source: "startup",
      permission_mode: "default"
    })
  }),
  "codex SessionStart hook"
);

await expectAccepted(
  app.request("/integrations/codex/hook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: codexSessionId,
      hook_event_name: "UserPromptSubmit",
      turn_id: "codex_turn_1",
      prompt: codexSecretPrompt,
      cwd: "/workspace/tooltrace",
      model: "gpt-5.4",
      permission_mode: "default"
    })
  }),
  "codex UserPromptSubmit hook"
);

await expectAccepted(
  app.request("/integrations/codex/hook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: codexSessionId,
      hook_event_name: "PostToolUse",
      turn_id: "codex_turn_1",
      tool_name: "Bash",
      tool_use_id: "codex_tool_1",
      tool_input: {
        command: codexSecretCommand
      },
      tool_response: {
        stdout: "TOKEN=secret"
      },
      cwd: "/workspace/tooltrace",
      model: "gpt-5.4",
      permission_mode: "default"
    })
  }),
  "codex PostToolUse hook"
);

const codexRunsResponse = await app.request("/runs");
const codexRuns = await codexRunsResponse.json();
const codexRun = Array.isArray(codexRuns)
  ? codexRuns.find((run) => run.id === codexRunId)
  : undefined;

if (codexRun?.metadata?.agent !== "codex") {
  throw new Error("Expected Codex hook ingestion to create a metadata-backed run.");
}

const codexEventsResponse = await app.request(`/runs/${codexRunId}/events`);
const codexEvents = await codexEventsResponse.json();
const codexEventsJson = JSON.stringify(codexEvents);

if (!Array.isArray(codexEvents) || codexEvents.length !== 3) {
  throw new Error("Expected Codex hook ingestion to create three events.");
}

if (!codexEvents.some((event) => event.type === "run_started")) {
  throw new Error("Expected Codex SessionStart to map to run_started.");
}

if (!codexEvents.some((event) => event.name === "Bash" && event.status === "success")) {
  throw new Error("Expected Codex PostToolUse to map to a successful tool event.");
}

if (codexEventsJson.includes(codexSecretPrompt) || codexEventsJson.includes(codexSecretCommand)) {
  throw new Error("Expected Codex hook ingestion to redact raw prompt and tool input.");
}

await expectAccepted(
  app.request("/integrations/codex/hook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json"
  }),
  "unknown Codex hook payload"
);

const unknownCodexEventsResponse = await app.request("/runs/run_codex_unknown/events");
const unknownCodexEvents = await unknownCodexEventsResponse.json();

if (
  !Array.isArray(unknownCodexEvents) ||
  !unknownCodexEvents.some((event) => event.name === "unknown_hook_event" && event.status === "error")
) {
  throw new Error("Expected unknown Codex hook payload to create a minimal error event.");
}

const claudeSessionId = "claude_session_smoke";
const claudeRunId = "run_claude-code_claude_session_smoke";
const claudeSecretCommand = "cat ~/.ssh/id_rsa";

await expectAccepted(
  app.request("/integrations/claude-code/hook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: claudeSessionId,
      hook_event_name: "SessionStart",
      cwd: "/workspace/tooltrace",
      model: "claude-sonnet-4-6",
      source: "startup",
      permission_mode: "acceptEdits"
    })
  }),
  "Claude Code SessionStart hook"
);

await expectAccepted(
  app.request("/integrations/claude-code/hook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: claudeSessionId,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_use_id: "claude_tool_1",
      tool_input: {
        command: claudeSecretCommand
      },
      cwd: "/workspace/tooltrace",
      model: "claude-sonnet-4-6",
      permission_mode: "acceptEdits"
    })
  }),
  "Claude Code PreToolUse hook"
);

await expectAccepted(
  app.request("/integrations/claude-code/hook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: claudeSessionId,
      hook_event_name: "PostToolUseFailure",
      tool_name: "Bash",
      tool_use_id: "claude_tool_1",
      tool_input: {
        command: claudeSecretCommand
      },
      tool_response: {
        stderr: "permission denied"
      },
      cwd: "/workspace/tooltrace",
      model: "claude-sonnet-4-6",
      permission_mode: "acceptEdits"
    })
  }),
  "Claude Code PostToolUseFailure hook"
);

await expectAccepted(
  app.request("/integrations/claude-code/hook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: claudeSessionId,
      hook_event_name: "Stop",
      last_assistant_message: "I could not read the key.",
      cwd: "/workspace/tooltrace",
      model: "claude-sonnet-4-6",
      permission_mode: "acceptEdits"
    })
  }),
  "Claude Code Stop hook"
);

const claudeRunsResponse = await app.request("/runs");
const claudeRuns = await claudeRunsResponse.json();
const claudeRun = Array.isArray(claudeRuns)
  ? claudeRuns.find((run) => run.id === claudeRunId)
  : undefined;

if (claudeRun?.metadata?.agent !== "claude-code") {
  throw new Error("Expected Claude Code hook ingestion to create a metadata-backed run.");
}

const claudeEventsResponse = await app.request(`/runs/${claudeRunId}/events`);
const claudeEvents = await claudeEventsResponse.json();
const claudeEventsJson = JSON.stringify(claudeEvents);

if (!Array.isArray(claudeEvents) || claudeEvents.length !== 4) {
  throw new Error("Expected Claude Code hook ingestion to create four events.");
}

if (!claudeEvents.some((event) => event.name === "Bash" && event.status === "error")) {
  throw new Error("Expected Claude Code PostToolUseFailure to map to an error tool event.");
}

if (!claudeEvents.some((event) => event.type === "step_ended" && event.name === "turn")) {
  throw new Error("Expected Claude Code Stop to map to a completed turn event.");
}

if (claudeEventsJson.includes(claudeSecretCommand)) {
  throw new Error("Expected Claude Code hook ingestion to redact raw tool input.");
}

console.log("ToolTrace API smoke test passed.");

async function expectAccepted(responseResult: Response | Promise<Response>, label: string) {
  const response = await responseResult;

  if (response.status !== 202) {
    throw new Error(`Expected ${label} to return 202, got ${response.status}`);
  }
}
