/** Jev's list price: input tokens only, output is free (https://docs.typesafe.ai/models). */
export const USD_PER_MILLION_INPUT_TOKENS = 0.042;

export const costUsd = (inputTokens: number) => (inputTokens / 1_000_000) * USD_PER_MILLION_INPUT_TOKENS;

/** Claude Haiku 5.5's list price for prompts up to 100,000 tokens (https://platform.claude.com/docs/en/about-claude/pricing). */
export const SUMMARY_USD_PER_MILLION_INPUT_TOKENS = 0.1;
export const SUMMARY_USD_PER_MILLION_OUTPUT_TOKENS = 0.5;

export const summaryCostUsd = (inputTokens: number, outputTokens: number) =>
  (inputTokens * SUMMARY_USD_PER_MILLION_INPUT_TOKENS + outputTokens * SUMMARY_USD_PER_MILLION_OUTPUT_TOKENS) / 1_000_000;

export function formatUsdAmount(usd: number): string {
  // Evaluations cost fractions of a cent, so keep enough digits to show a real number.
  const digits = usd >= 1 ? 2 : usd >= 0.01 ? 3 : 4;
  return usd > 0 && usd < 0.0001 ? "under $0.0001" : `$${usd.toFixed(digits)}`;
}

export const formatUsd = (inputTokens: number) => formatUsdAmount(costUsd(inputTokens));

export const formatTokens = (inputTokens: number) => `${inputTokens.toLocaleString("en-US")} input tokens`;

export function formatCost(inputTokens: number | null): string {
  if (inputTokens === null) return "cost not reported";
  return `${formatUsd(inputTokens)} (${formatTokens(inputTokens)})`;
}

export const formatDuration = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
