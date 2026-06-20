import { startRun } from "./index.js";

type FetchCall = {
  url: string;
  method: string;
  body: unknown;
};

const calls: FetchCall[] = [];

globalThis.fetch = async (input, init) => {
  calls.push({
    url: String(input),
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : undefined
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
};

const run = startRun({
  name: "sdk-smoke",
  input: { task: "exercise sdk" },
  endpoint: "http://collector.test/"
});

const result = await run.traceTool(
  "web_search",
  { query: "MCP ecosystem" },
  async () => ({ result: "ok" })
);

if (result.result !== "ok") {
  throw new Error("Expected traceTool to return the wrapped result.");
}

try {
  await run.traceLLM(
    "planner",
    { prompt: "Plan" },
    async () => {
      throw new Error("timeout");
    },
    {
      provider: "fake",
      model: "fake-model",
      tokenUsage: { input: 10, output: 2, total: 12 }
    }
  );
} catch {
  // Expected: traceLLM must rethrow the wrapped failure.
}

await run.fail(new Error("agent failed"));

assertCall("POST", "http://collector.test/runs");
assertCall("POST", "http://collector.test/events");
assertCall("PATCH", `http://collector.test/runs/${run.id}`);

const failedEvent = calls.find(
  (call) =>
    call.method === "POST" &&
    call.url.endsWith("/events") &&
    typeof call.body === "object" &&
    call.body !== null &&
    "status" in call.body &&
    call.body.status === "error"
);

if (!failedEvent) {
  throw new Error("Expected SDK to emit an error event for failed traceLLM.");
}

console.log("Agent-Trace SDK smoke test passed.");

function assertCall(method: string, url: string) {
  const matched = calls.some((call) => call.method === method && call.url === url);

  if (!matched) {
    throw new Error(`Expected ${method} ${url} to be called.`);
  }
}
