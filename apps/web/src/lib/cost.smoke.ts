import { calculateRunCost } from "./cost";

const openAiCost = calculateRunCost(
  {
    models: ["gpt-5.4"],
    tokenUsage: {
      input: 100,
      output: 20,
      total: 120,
      cachedInput: 60
    }
  },
  { rate: 7.2, source: "env" }
);

expectClose(openAiCost.usd, 0.0002078, "OpenAI cached input cost");
expectClose(openAiCost.cny, 0.00149616, "OpenAI CNY conversion");

const claudeCost = calculateRunCost(
  {
    modelUsage: [
      {
        model: "claude-sonnet-4-6",
        provider: "anthropic",
        tokenUsage: {
          input: 8320,
          output: 900,
          total: 12450,
          cacheCreationInput: 1000,
          cacheReadInput: 2230
        }
      }
    ]
  },
  { rate: 7.2, source: "env" }
);

expectClose(claudeCost.usd, 0.042879, "Claude cache write/read cost");

const unknownCost = calculateRunCost({
  models: ["unknown-model"],
  tokenUsage: {
    input: 1,
    output: 1,
    total: 2,
    estimated: true
  }
});

if (unknownCost.usd !== undefined || !unknownCost.estimated) {
  throw new Error("Expected unknown model costs to be unpriced but estimated.");
}

if (!unknownCost.unpricedModels.includes("unknown-model")) {
  throw new Error("Expected unknown model name to be reported as unpriced.");
}

console.log("ToolTrace cost smoke test passed.");

function expectClose(actual: number | undefined, expected: number, label: string) {
  if (actual === undefined || Math.abs(actual - expected) > 0.0000001) {
    throw new Error(`Expected ${label} to be ${expected}, got ${actual ?? "undefined"}.`);
  }
}
