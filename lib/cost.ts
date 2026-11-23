/** The two models that can evaluate a file. */
export const ENGINES = [
  { key: "jev", label: "Jev" },
  { key: "haiku", label: "Claude Haiku" },
] as const;

export type Engine = (typeof ENGINES)[number]["key"];

export const engineLabel = (engine: Engine) => ENGINES.find((e) => e.key === engine)!.label;

export interface Tokens {
  inputTokens: number;
  /** For Claude this includes the model's thinking. */
  outputTokens: number;
}

/**
 * List prices in USD per million tokens.
 * Jev bills input only (https://docs.typesafe.ai/models).
 * Haiku is Claude Haiku 5.5, for prompts up to 100,000 tokens (https://platform.claude.com/docs/en/about-claude/pricing).
 */
export const USD_PER_MILLION_TOKENS: Record<Engine, { input: number; output: number }> = {
  jev: { input: 0.042, output: 0 },
  haiku: { input: 0.1, output: 0.5 },
};

export const costUsd = (engine: Engine, { inputTokens, outputTokens }: Tokens) =>
  (inputTokens * USD_PER_MILLION_TOKENS[engine].input + outputTokens * USD_PER_MILLION_TOKENS[engine].output) / 1_000_000;

export function formatUsdAmount(usd: number): string {
  // Evaluations cost fractions of a cent, so keep enough digits to show a real number.
  const digits = usd >= 1 ? 2 : usd >= 0.01 ? 3 : 4;
  return usd > 0 && usd < 0.0001 ? "under $0.0001" : `$${usd.toFixed(digits)}`;
}

const count = (tokens: number) => tokens.toLocaleString("en-US");

export const formatTokens = ({ inputTokens, outputTokens }: Tokens) =>
  outputTokens > 0 ? `${count(inputTokens)} in · ${count(outputTokens)} out` : `${count(inputTokens)} input tokens`;

export function formatCost(engine: Engine, tokens: Tokens | null): string {
  if (tokens === null) return "cost not reported";
  return `${formatUsdAmount(costUsd(engine, tokens))} (${formatTokens(tokens)})`;
}

export const formatDuration = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
