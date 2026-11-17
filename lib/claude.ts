import Anthropic from "@anthropic-ai/sdk";
import type { SummaryCheck, SummaryResponse } from "./summary";

// The cheapest current Claude model; a short summary of structured results does not need more.
const SUMMARY_MODEL = "claude-haiku-5-5";

const SYSTEM = `You summarize the results of automated checks that were run on a MISMO 3.4 residential loan application file (URLA / Form 1003 data). The reader is a loan processor who has just uploaded the file and wants to know, at a glance, what state it is in and what to fix before it moves on.

The user message is a JSON list of checks. Each one has the section of the file it belongs to, the question that was asked about the file, the answer an evaluator model gave, and a verdict:
- "pass": the file meets the check.
- "fail": the file does not meet the check. These are the problems to fix.
- "review": the evaluator was not confident either way, so a person should look.
- "info": a factual answer with nothing to compare against, such as the loan purpose.

Write a short summary of at most 80 words. Start with the overall state of the file, then say what failed and what needs review, naming the specific problems and not just counting them. If everything passed, say so in one or two sentences. Base every statement on the checks you were given; you have not seen the file itself, so do not guess at values or causes.

The summary is shown as plain text in a narrow side panel, so write plain sentences with no Markdown, headings or bullet characters.`;

/** Asks Claude for a short summary of the results. Returns null when Claude gives no text, for example when it declines. */
export async function summarizeWithClaude(checks: SummaryCheck[]): Promise<SummaryResponse | null> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: SUMMARY_MODEL,
    // Leaves room for the model's thinking, which counts toward this limit.
    max_tokens: 2048,
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(checks) }],
  });
  const summary = response.content
    .flatMap((block) => (block.type === "text" ? block.text : []))
    .join("")
    .trim();
  if (!summary) return null;
  const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } = response.usage;
  return {
    summary,
    model: response.model,
    inputTokens: input_tokens + (cache_creation_input_tokens ?? 0) + (cache_read_input_tokens ?? 0),
    outputTokens: output_tokens,
  };
}
