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

expectClose(openAiCost.usd, 0.000415, "OpenAI cached input cost");
expectClose(openAiCost.cny, 0.002988, "OpenAI CNY conversion");

const openAiReasoningSeparatedCost = calculateRunCost({
  models: ["gpt-5.5"],
  tokenUsage: {
    input: 15,
    output: 471,
    reasoningOutput: 11394,
    total: 11880
  }
});

expectClose(openAiReasoningSeparatedCost.usd, 0.356025, "OpenAI separated reasoning output cost");

const openAiReasoningIncludedCost = calculateRunCost({
  models: ["gpt-5.5"],
  tokenUsage: {
    input: 75,
    output: 1186,
    reasoningOutput: 1024,
    total: 1261
  }
});

expectClose(openAiReasoningIncludedCost.usd, 0.035955, "OpenAI included reasoning output cost");

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

const deepSeekProCost = calculateRunCost(
  {
    modelUsage: [
      {
        model: "deepseek-v4-pro",
        provider: "deepseek",
        tokenUsage: {
          input: 9,
          output: 455,
          total: 464
        }
      }
    ]
  },
  { rate: 7.2, source: "env" }
);

expectClose(deepSeekProCost.usd, 0.000399765, "DeepSeek V4 Pro cost");
expectClose(deepSeekProCost.cny, 0.002878308, "DeepSeek V4 Pro CNY conversion");

const deepSeekAliasCost = calculateRunCost({
  modelUsage: [
    {
      model: "deepseek-reasoner",
      provider: "deepseek",
      tokenUsage: {
        input: 1000,
        output: 1000,
        total: 2000,
        cachedInput: 100
      }
    }
  ]
});

expectClose(deepSeekAliasCost.usd, 0.00040628, "DeepSeek compatibility alias cost");

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

console.log("Agent-Trace cost smoke test passed.");

function expectClose(actual: number | undefined, expected: number, label: string) {
  if (actual === undefined || Math.abs(actual - expected) > 0.0000001) {
    throw new Error(`Expected ${label} to be ${expected}, got ${actual ?? "undefined"}.`);
  }
}
