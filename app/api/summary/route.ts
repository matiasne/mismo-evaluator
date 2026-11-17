import Anthropic from "@anthropic-ai/sdk";
import { summarizeWithClaude } from "@/lib/claude";
import { summaryRequestSchema, type SummaryResponse } from "@/lib/summary";

export const runtime = "nodejs";
export const maxDuration = 60;

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return error("The Anthropic API key is not configured. Set ANTHROPIC_API_KEY on the server.", 503);
  }

  const body = summaryRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("The request is not valid: it needs at least one result.", 400);

  try {
    const summary = await summarizeWithClaude(body.data.checks);
    if (summary === null) return error("Claude returned no summary.", 502);
    return Response.json(summary satisfies SummaryResponse);
  } catch (cause) {
    if (cause instanceof Anthropic.AuthenticationError) return error("Anthropic rejected the API key.", 502);
    if (cause instanceof Anthropic.RateLimitError) return error("Anthropic is rate limiting requests. Try again in a moment.", 429);
    // A connection error is also an APIError, so it has to be checked first.
    if (cause instanceof Anthropic.APIConnectionError) return error("Could not reach Anthropic. Try again.", 504);
    if (cause instanceof Anthropic.APIError) return error(`Claude could not summarize the results (${cause.status}): ${cause.message}`, 502);
    throw cause;
  }
}
