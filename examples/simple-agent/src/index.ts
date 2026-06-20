import { startRun } from "@agent-trace/sdk";

const task =
  process.env.AGENT_TRACE_EXAMPLE_TASK ??
  process.env.TOOLTRACE_EXAMPLE_TASK ??
  "Research MCP ecosystem";

async function main() {
  const run = startRun({
    name: "simple-agent",
    input: { task },
    endpoint: process.env.AGENT_TRACE_ENDPOINT ?? process.env.TOOLTRACE_ENDPOINT
  });

  try {
    const plan = await run.traceLLM(
      "planner",
      { prompt: task },
      () => fakeLLM(task),
      {
        provider: "fake",
        model: "fake-planner",
        tokenUsage: {
          input: 120,
          output: 42,
          total: 162
        }
      }
    );

    const searchResult = await run.traceTool(
      "web_search",
      { query: "MCP ecosystem" },
      () => fakeTool("MCP ecosystem")
    );

    if ((process.env.AGENT_TRACE_EXAMPLE_FAIL ?? process.env.TOOLTRACE_EXAMPLE_FAIL) === "1") {
      await run.traceTool("fetch_source", { url: "https://example.test/slow" }, async () => {
        await sleep(120);
        throw new Error("Request timed out after 100ms");
      });
    }

    await run.end({
      plan,
      searchResult
    });
  } catch (err) {
    await run.fail(err);
    throw err;
  }
}

async function fakeLLM(prompt: string) {
  await sleep(80);

  return {
    plan: `Search for sources about: ${prompt}`
  };
}

async function fakeTool(query: string) {
  await sleep(50);

  return {
    result: `Found local demo result for ${query}`
  };
}

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

await main();
