import type { TraceEventType, TraceMetadata } from "@tooltrace/schema";

export type StartRunOptions = {
  name: string;
  input?: unknown;
  endpoint?: string;
};

export type TraceStepOptions = {
  parentId?: string;
  metadata?: TraceMetadata;
};

export type TraceRun = {
  id: string;
  traceLLM<T>(
    name: string,
    input: unknown,
    fn: () => Promise<T>,
    metadata?: TraceMetadata
  ): Promise<T>;
  traceTool<T>(
    name: string,
    input: unknown,
    fn: () => Promise<T>,
    options?: TraceStepOptions
  ): Promise<T>;
  end(output?: unknown): Promise<void>;
  fail(error: unknown): Promise<void>;
};

const defaultEndpoint = "http://localhost:4319";

export function startRun(options: StartRunOptions): TraceRun {
  const endpoint = trimTrailingSlash(options.endpoint ?? defaultEndpoint);
  const runId = createId("run");
  const startPromise = post(endpoint, "/runs", {
    id: runId,
    name: options.name,
    status: "running",
    startedAt: new Date().toISOString(),
    input: options.input
  });

  async function traceStep<T>(
    type: TraceEventType,
    name: string,
    input: unknown,
    fn: () => Promise<T>,
    options?: TraceStepOptions
  ): Promise<T> {
    const eventId = createId("evt");
    const started = Date.now();

    await startPromise;

    try {
      const output = await fn();

      await post(endpoint, "/events", {
        id: eventId,
        runId,
        parentId: options?.parentId,
        type,
        name,
        status: "success",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - started,
        input,
        output,
        metadata: options?.metadata
      });

      return output;
    } catch (err) {
      await post(endpoint, "/events", {
        id: eventId,
        runId,
        parentId: options?.parentId,
        type,
        name,
        status: "error",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - started,
        input,
        error: serializeError(err),
        metadata: options?.metadata
      });

      throw err;
    }
  }

  return {
    id: runId,
    traceLLM<T>(
      name: string,
      input: unknown,
      fn: () => Promise<T>,
      metadata?: TraceMetadata
    ) {
      return traceStep("llm_call", name, input, fn, { metadata });
    },
    traceTool<T>(
      name: string,
      input: unknown,
      fn: () => Promise<T>,
      options?: TraceStepOptions
    ) {
      return traceStep("tool_call", name, input, fn, options);
    },
    async end(output?: unknown) {
      await startPromise;
      await patch(endpoint, `/runs/${runId}`, {
        status: "success",
        endedAt: new Date().toISOString(),
        output
      });
    },
    async fail(error: unknown) {
      await startPromise;
      await patch(endpoint, `/runs/${runId}`, {
        status: "error",
        endedAt: new Date().toISOString(),
        error: serializeError(error).message
      });
    }
  };
}

export const tracer = {
  startRun
};

async function post(endpoint: string, path: string, body: unknown) {
  await send(endpoint, path, "POST", body);
}

async function patch(endpoint: string, path: string, body: unknown) {
  await send(endpoint, path, "PATCH", body);
}

async function send(endpoint: string, path: string, method: "PATCH" | "POST", body: unknown) {
  try {
    await fetch(`${endpoint}${path}`, {
      method,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch {
    // Tracing must not change the behavior of the user's agent.
  }
}

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

  return `${prefix}_${randomId}`;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
