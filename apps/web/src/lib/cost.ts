type TokenUsage = {
  input?: number;
  output?: number;
  total?: number;
  cachedInput?: number;
  cacheCreationInput?: number;
  cacheReadInput?: number;
  reasoningOutput?: number;
  estimated?: boolean;
};

type ModelUsage = {
  model: string;
  provider?: string;
  tokenUsage: TokenUsage;
};

type CostSummary = {
  tokenUsage?: TokenUsage;
  models?: string[];
  modelUsage?: ModelUsage[];
};

type ModelPricing = {
  provider: "openai" | "anthropic" | "deepseek";
  input: number;
  output: number;
  cachedInput?: number;
  cacheWrite5m?: number;
  cacheRead?: number;
};

export type ExchangeRate = {
  rate: number;
  updatedAt?: string;
  source: "env" | "open.er-api.com";
};

export type RunCost = {
  usd?: number;
  cny?: number;
  exchangeRate?: number;
  exchangeRateUpdatedAt?: string;
  estimated: boolean;
  unpricedModels: string[];
};

const defaultExchangeRateUrl = "https://open.er-api.com/v6/latest/USD";

const baseModelPricing: Record<string, ModelPricing> = {
  "gpt-5.5": { provider: "openai", input: 5, cachedInput: 0.5, output: 30 },
  "gpt-5.5-pro": { provider: "openai", input: 30, output: 180 },
  "gpt-5.4": { provider: "openai", input: 2.5, cachedInput: 0.25, output: 15 },
  "gpt-5.4-mini": { provider: "openai", input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.4-nano": { provider: "openai", input: 0.2, cachedInput: 0.02, output: 1.25 },
  "gpt-5.4-pro": { provider: "openai", input: 30, output: 180 },
  "gpt-5.3-codex": { provider: "openai", input: 1.75, cachedInput: 0.175, output: 14 },
  "claude-fable-5": {
    provider: "anthropic",
    input: 10,
    cacheWrite5m: 12.5,
    cacheRead: 1,
    output: 50
  },
  "claude-mythos-5": {
    provider: "anthropic",
    input: 10,
    cacheWrite5m: 12.5,
    cacheRead: 1,
    output: 50
  },
  "claude-opus-4.8": { provider: "anthropic", input: 5, cacheWrite5m: 6.25, cacheRead: 0.5, output: 25 },
  "claude-opus-4.7": { provider: "anthropic", input: 5, cacheWrite5m: 6.25, cacheRead: 0.5, output: 25 },
  "claude-opus-4.6": { provider: "anthropic", input: 5, cacheWrite5m: 6.25, cacheRead: 0.5, output: 25 },
  "claude-opus-4.5": { provider: "anthropic", input: 5, cacheWrite5m: 6.25, cacheRead: 0.5, output: 25 },
  "claude-opus-4.1": { provider: "anthropic", input: 15, cacheWrite5m: 18.75, cacheRead: 1.5, output: 75 },
  "claude-opus-4": { provider: "anthropic", input: 15, cacheWrite5m: 18.75, cacheRead: 1.5, output: 75 },
  "claude-sonnet-4.6": { provider: "anthropic", input: 3, cacheWrite5m: 3.75, cacheRead: 0.3, output: 15 },
  "claude-sonnet-4.5": { provider: "anthropic", input: 3, cacheWrite5m: 3.75, cacheRead: 0.3, output: 15 },
  "claude-sonnet-4": { provider: "anthropic", input: 3, cacheWrite5m: 3.75, cacheRead: 0.3, output: 15 },
  "claude-haiku-4.5": { provider: "anthropic", input: 1, cacheWrite5m: 1.25, cacheRead: 0.1, output: 5 },
  "claude-haiku-3.5": { provider: "anthropic", input: 0.8, cacheWrite5m: 1, cacheRead: 0.08, output: 4 },
  "deepseek-v4-flash": { provider: "deepseek", input: 0.14, cachedInput: 0.0028, output: 0.28 },
  "deepseek-v4-pro": { provider: "deepseek", input: 0.435, cachedInput: 0.003625, output: 0.87 }
};

export async function getUsdCnyRate(): Promise<ExchangeRate | undefined> {
  const envRate = Number(process.env.TOOLTRACE_USD_CNY_RATE);

  if (Number.isFinite(envRate) && envRate > 0) {
    return {
      rate: envRate,
      source: "env"
    };
  }

  try {
    const response = await fetch(process.env.TOOLTRACE_EXCHANGE_RATE_URL ?? defaultExchangeRateUrl, {
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as {
      rates?: { CNY?: number };
      time_last_update_utc?: string;
    };
    const rate = payload.rates?.CNY;

    return typeof rate === "number" && Number.isFinite(rate) && rate > 0
      ? {
          rate,
          updatedAt: payload.time_last_update_utc,
          source: "open.er-api.com"
        }
      : undefined;
  } catch {
    return undefined;
  }
}

export function calculateRunCost(summary: CostSummary | undefined, exchangeRate?: ExchangeRate): RunCost {
  const usages = getCostUsages(summary);
  const unpricedModels: string[] = [];
  let usd = 0;
  let estimated = Boolean(summary?.tokenUsage?.estimated);

  for (const usage of usages) {
    const pricing = getModelPricing(usage.model, usage.provider);

    estimated = estimated || Boolean(usage.tokenUsage.estimated);

    if (!pricing) {
      pushUnique(unpricedModels, usage.model);
      continue;
    }

    usd += calculateUsageCost(usage.tokenUsage, pricing);
  }

  const roundedUsd = usd > 0 ? usd : undefined;

  return {
    usd: roundedUsd,
    cny: roundedUsd !== undefined && exchangeRate ? roundedUsd * exchangeRate.rate : undefined,
    exchangeRate: exchangeRate?.rate,
    exchangeRateUpdatedAt: exchangeRate?.updatedAt,
    estimated,
    unpricedModels
  };
}

function getCostUsages(summary: CostSummary | undefined): ModelUsage[] {
  if (!summary) {
    return [];
  }

  if (summary.modelUsage && summary.modelUsage.length > 0) {
    return summary.modelUsage;
  }

  const onlyModel = summary.models?.length === 1 ? summary.models[0] : undefined;

  if (onlyModel && summary.tokenUsage?.total) {
    return [
      {
        model: onlyModel,
        tokenUsage: summary.tokenUsage
      }
    ];
  }

  return [];
}

function calculateUsageCost(usage: TokenUsage, pricing: ModelPricing) {
  const input = usage.input ?? 0;
  const cachedInput = usage.cachedInput ?? usage.cacheReadInput ?? 0;
  const cacheCreationInput = usage.cacheCreationInput ?? 0;
  const cacheReadInput = usage.cacheReadInput ?? usage.cachedInput ?? 0;

  if (pricing.provider === "anthropic") {
    const output = getBillableOutputTokens(usage, input + cacheCreationInput + cacheReadInput);

    return (
      (input * pricing.input +
        output * pricing.output +
        cacheCreationInput * (pricing.cacheWrite5m ?? pricing.input) +
        cacheReadInput * (pricing.cacheRead ?? pricing.cachedInput ?? pricing.input)) /
      1_000_000
    );
  }

  const output = getBillableOutputTokens(usage, input);

  return (
    (Math.max(0, input - cachedInput) * pricing.input +
      cachedInput * (pricing.cachedInput ?? pricing.input) +
      output * pricing.output) /
    1_000_000
  );
}

function getBillableOutputTokens(usage: TokenUsage, nonOutputTokens: number) {
  const output = usage.output ?? 0;
  const total = usage.total;

  if (typeof total === "number") {
    const generatedFromTotal = total - nonOutputTokens;

    if (Number.isFinite(generatedFromTotal) && generatedFromTotal >= 0) {
      return Math.max(output, generatedFromTotal);
    }
  }

  return output + (usage.reasoningOutput ?? 0);
}

function getModelPricing(model: string, provider: string | undefined) {
  const pricing = getConfiguredPricing()[normalizeModel(model)];

  if (pricing) {
    return pricing;
  }

  const inferred = inferPricingKey(model, provider);

  return inferred ? getConfiguredPricing()[inferred] : undefined;
}

let configuredPricing: Record<string, ModelPricing> | undefined;

function getConfiguredPricing() {
  if (configuredPricing !== undefined) {
    return configuredPricing;
  }

  configuredPricing = {
    ...baseModelPricing,
    ...parsePricingOverrides(process.env.TOOLTRACE_MODEL_PRICES_JSON)
  };

  return configuredPricing;
}

function parsePricingOverrides(value: string | undefined): Record<string, ModelPricing> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, ModelPricing>;

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, pricing]) => isValidPricing(pricing))
        .map(([model, pricing]) => [normalizeModel(model), pricing])
    );
  } catch {
    return {};
  }
}

function isValidPricing(value: ModelPricing) {
  return (
    value !== null &&
    typeof value === "object" &&
    (value.provider === "openai" ||
      value.provider === "anthropic" ||
      value.provider === "deepseek") &&
    isNonnegativeNumber(value.input) &&
    isNonnegativeNumber(value.output)
  );
}

function inferPricingKey(model: string, provider: string | undefined) {
  const normalized = normalizeModel(model);
  const dashed = normalized.replaceAll(".", "-");

  if (provider === "openai" || normalized.startsWith("gpt-")) {
    if (normalized.includes("gpt-5.5-pro")) return "gpt-5.5-pro";
    if (normalized.includes("gpt-5.5")) return "gpt-5.5";
    if (normalized.includes("gpt-5.4-mini")) return "gpt-5.4-mini";
    if (normalized.includes("gpt-5.4-nano")) return "gpt-5.4-nano";
    if (normalized.includes("gpt-5.4-pro")) return "gpt-5.4-pro";
    if (normalized.includes("gpt-5.4")) return "gpt-5.4";
    if (normalized.includes("gpt-5.3-codex")) return "gpt-5.3-codex";
  }

  if (provider === "anthropic" || normalized.includes("claude")) {
    if (dashed.includes("fable-5")) return "claude-fable-5";
    if (dashed.includes("mythos-5")) return "claude-mythos-5";
    if (dashed.includes("opus-4-8")) return "claude-opus-4.8";
    if (dashed.includes("opus-4-7")) return "claude-opus-4.7";
    if (dashed.includes("opus-4-6")) return "claude-opus-4.6";
    if (dashed.includes("opus-4-5")) return "claude-opus-4.5";
    if (dashed.includes("opus-4-1")) return "claude-opus-4.1";
    if (dashed.includes("opus-4")) return "claude-opus-4";
    if (dashed.includes("sonnet-4-6")) return "claude-sonnet-4.6";
    if (dashed.includes("sonnet-4-5")) return "claude-sonnet-4.5";
    if (dashed.includes("sonnet-4")) return "claude-sonnet-4";
    if (dashed.includes("haiku-4-5")) return "claude-haiku-4.5";
    if (dashed.includes("haiku-3-5")) return "claude-haiku-3.5";
  }

  if (provider === "deepseek" || normalized.includes("deepseek")) {
    if (normalized.includes("deepseek-v4-pro")) return "deepseek-v4-pro";
    if (normalized.includes("deepseek-v4-flash")) return "deepseek-v4-flash";
    if (normalized.includes("deepseek-chat")) return "deepseek-v4-flash";
    if (normalized.includes("deepseek-reasoner")) return "deepseek-v4-flash";
  }

  return undefined;
}

function normalizeModel(model: string) {
  return model.trim().toLowerCase();
}

function isNonnegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) {
    values.push(value);
  }
}
