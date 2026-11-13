/** Jev's list price: input tokens only, output is free (https://docs.typesafe.ai/models). */
export const USD_PER_MILLION_INPUT_TOKENS = 0.042;

export const costUsd = (inputTokens: number) => (inputTokens / 1_000_000) * USD_PER_MILLION_INPUT_TOKENS;

export function formatUsd(inputTokens: number): string {
  const usd = costUsd(inputTokens);
  // Evaluations cost fractions of a cent, so keep enough digits to show a real number.
  const digits = usd >= 1 ? 2 : usd >= 0.01 ? 3 : 4;
  return usd > 0 && usd < 0.0001 ? "under $0.0001" : `$${usd.toFixed(digits)}`;
}

export const formatTokens = (inputTokens: number) => `${inputTokens.toLocaleString("en-US")} input tokens`;

export function formatCost(inputTokens: number | null): string {
  if (inputTokens === null) return "cost not reported";
  return `${formatUsd(inputTokens)} (${formatTokens(inputTokens)})`;
}

export const formatDuration = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
