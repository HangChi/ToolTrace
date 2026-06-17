import { randomUUID } from "node:crypto";

import type {
  CreateRun,
  CreateTraceEvent,
  TraceEventType,
  TraceMetadata,
  TraceStatus,
  UpdateRun
} from "@tooltrace/schema";

import { createEvent, createRun, getRunById, updateRun } from "./storage.js";

export type AgentHookSource = "codex" | "claude-code";

type NormalizedHookTrace = {
  run: CreateRun;
  event: CreateTraceEvent;
  runUpdate?: UpdateRun;
};

const redactionLevel = "metadata";

const knownHookEvents = new Set([
  "SessionStart",
  "Setup",
  "InstructionsLoaded",
  "UserPromptSubmit",
  "UserPromptExpansion",
  "MessageDisplay",
  "PreToolUse",
  "PermissionRequest",
  "PermissionDenied",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "TaskCreated",
  "TaskCompleted",
  "Stop",
  "StopFailure",
  "TeammateIdle",
  "ConfigChange",
  "CwdChanged",
  "FileChanged",
  "WorktreeCreate",
  "WorktreeRemove",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
  "Elicitation",
  "ElicitationResult"
]);

const errorHookEvents = new Set(["PermissionDenied", "PostToolUseFailure", "StopFailure"]);

export async function ingestAgentHook(source: AgentHookSource, payload: unknown) {
  const normalized = normalizeAgentHook(source, payload);
  const existingRun = await getRunById(normalized.run.id);

  if (!existingRun) {
    await createRun(normalized.run);
  }

  await createEvent(normalized.event);

  if (normalized.runUpdate) {
    await updateRun(normalized.run.id, normalized.runUpdate);
  }

  return {
    eventId: normalized.event.id,
    runId: normalized.run.id
  };
}

export function normalizeAgentHook(
  source: AgentHookSource,
  payload: unknown
): NormalizedHookTrace {
  const body = asRecord(payload);
  const hookEvent = getString(body, "hook_event_name", "hookEventName", "hookEvent") ?? "unknown";
  const sessionId =
    getString(body, "session_id", "sessionId", "conversation_id", "conversationId") ?? "unknown";
  const turnId = getString(body, "turn_id", "turnId", "prompt_id", "promptId");
  const promptId = getString(body, "prompt_id", "promptId");
  const toolName = getString(body, "tool_name", "toolName");
  const toolUseId = getString(body, "tool_use_id", "toolUseId");
  const model = getString(body, "model");
  const permissionMode = getString(body, "permission_mode", "permissionMode");
  const cwd = getString(body, "cwd");
  const isKnownHookEvent = knownHookEvents.has(hookEvent);
  const status = isKnownHookEvent ? getHookStatus(hookEvent) : "error";
  const eventType = isKnownHookEvent ? getHookEventType(hookEvent) : "error";
  const metadata = compactMetadata({
    agent: source,
    surface: "cli",
    sessionId,
    turnId,
    promptId,
    toolUseId,
    hookEvent,
    permissionMode,
    cwd,
    redactionLevel,
    model,
    source: getString(body, "source"),
    agentId: getString(body, "agent_id", "agentId"),
    agentType: getString(body, "agent_type", "agentType", "subagent_type", "subagentType"),
    toolInputSizeBytes: getJsonSizeBytes(getValue(body, "tool_input", "toolInput")),
    toolResponseSizeBytes: getJsonSizeBytes(getValue(body, "tool_response", "toolResponse")),
    promptLength: getString(body, "prompt")?.length,
    lastAssistantMessageLength: getString(
      body,
      "last_assistant_message",
      "lastAssistantMessage"
    )?.length
  });

  const run: CreateRun = {
    id: createRunId(source, sessionId),
    name: `${source}:${sessionId}`,
    status: "running",
    input: {
      source: "agent-hook",
      redactionLevel
    },
    metadata
  };
  const event: CreateTraceEvent = {
    id: createId("evt"),
    runId: run.id,
    type: eventType,
    name: getHookEventName(hookEvent, toolName, metadata),
    status,
    timestamp: new Date().toISOString(),
    durationMs: getNonnegativeNumber(body, "duration_ms", "durationMs"),
    input: getRedactedInput(hookEvent, body),
    output: getRedactedOutput(hookEvent, body),
    error:
      status === "error"
        ? {
            message: isKnownHookEvent
              ? `Agent hook reported ${hookEvent}`
              : "Unknown agent hook payload"
          }
        : undefined,
    metadata
  };
  const runUpdate = getRunUpdate(hookEvent);

  return {
    run,
    event,
    runUpdate
  };
}

function getHookStatus(hookEvent: string): TraceStatus {
  if (errorHookEvents.has(hookEvent)) {
    return "error";
  }

  if (
    hookEvent === "SessionStart" ||
    hookEvent === "Setup" ||
    hookEvent === "UserPromptSubmit" ||
    hookEvent === "UserPromptExpansion" ||
    hookEvent === "PreToolUse" ||
    hookEvent === "PermissionRequest" ||
    hookEvent === "SubagentStart" ||
    hookEvent === "TaskCreated" ||
    hookEvent === "PreCompact" ||
    hookEvent === "Elicitation"
  ) {
    return "running";
  }

  return "success";
}

function getHookEventType(hookEvent: string): TraceEventType {
  if (hookEvent === "SessionStart") {
    return "run_started";
  }

  if (hookEvent === "SessionEnd") {
    return "run_ended";
  }

  if (
    hookEvent === "PostToolUse" ||
    hookEvent === "PostToolUseFailure" ||
    hookEvent === "PermissionDenied"
  ) {
    return "tool_call";
  }

  if (
    hookEvent === "StopFailure" ||
    hookEvent === "unknown" ||
    errorHookEvents.has(hookEvent)
  ) {
    return "error";
  }

  if (
    hookEvent === "PostToolBatch" ||
    hookEvent === "SubagentStop" ||
    hookEvent === "TaskCompleted" ||
    hookEvent === "Stop" ||
    hookEvent === "PostCompact" ||
    hookEvent === "ElicitationResult"
  ) {
    return "step_ended";
  }

  return "step_started";
}

function getHookEventName(
  hookEvent: string,
  toolName: string | undefined,
  metadata: TraceMetadata
) {
  if (toolName) {
    return toolName;
  }

  if (hookEvent === "UserPromptSubmit") {
    return "user_prompt";
  }

  if (hookEvent === "SubagentStart" || hookEvent === "SubagentStop") {
    const agentType = typeof metadata.agentType === "string" ? metadata.agentType : "unknown";

    return `subagent:${agentType}`;
  }

  if (hookEvent === "SessionStart" || hookEvent === "SessionEnd") {
    return "session";
  }

  if (hookEvent === "Stop" || hookEvent === "StopFailure") {
    return "turn";
  }

  if (!knownHookEvents.has(hookEvent)) {
    return "unknown_hook_event";
  }

  return hookEvent;
}

function getRunUpdate(hookEvent: string): UpdateRun | undefined {
  if (hookEvent === "SessionEnd") {
    return {
      status: "success",
      endedAt: new Date().toISOString()
    };
  }

  if (hookEvent === "StopFailure") {
    return {
      status: "error",
      endedAt: new Date().toISOString(),
      error: "Agent hook reported StopFailure"
    };
  }

  return undefined;
}

function getRedactedInput(hookEvent: string, body: Record<string, unknown>) {
  if (hookEvent === "UserPromptSubmit") {
    const prompt = getString(body, "prompt");

    return prompt === undefined
      ? undefined
      : {
          promptLength: prompt.length
        };
  }

  const toolInputSizeBytes = getJsonSizeBytes(getValue(body, "tool_input", "toolInput"));

  if (toolInputSizeBytes !== undefined) {
    return {
      toolInputSizeBytes
    };
  }

  const source = getString(body, "source");

  return source === undefined
    ? undefined
    : {
        source
      };
}

function getRedactedOutput(hookEvent: string, body: Record<string, unknown>) {
  if (hookEvent === "Stop" || hookEvent === "StopFailure") {
    const lastAssistantMessage = getString(body, "last_assistant_message", "lastAssistantMessage");

    return lastAssistantMessage === undefined
      ? undefined
      : {
          lastAssistantMessageLength: lastAssistantMessage.length
        };
  }

  const toolResponseSizeBytes = getJsonSizeBytes(getValue(body, "tool_response", "toolResponse"));

  return toolResponseSizeBytes === undefined
    ? undefined
    : {
        toolResponseSizeBytes
      };
}

function createRunId(source: AgentHookSource, sessionId: string) {
  return `run_${toIdPart(source)}_${toIdPart(sessionId)}`;
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

function toIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "unknown";
}

function getString(record: Record<string, unknown>, ...keys: string[]) {
  const value = getValue(record, ...keys);

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNonnegativeNumber(record: Record<string, unknown>, ...keys: string[]) {
  const value = getValue(record, ...keys);

  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function getValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function getJsonSizeBytes(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function compactMetadata(value: TraceMetadata) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as TraceMetadata;
}
