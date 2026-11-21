import Anthropic from "@anthropic-ai/sdk";
import { MAX_XML_BYTES, parseMismo } from "@/lib/mismo/parse";
import { evaluateWithOpus } from "@/lib/opus";
import { evaluateRequestSchema } from "@/lib/questions";

export const runtime = "nodejs";
// Opus thinks before it answers, so a section can take much longer than it does with Jev.
export const maxDuration = 300;

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return error("The Anthropic API key is not configured. Set ANTHROPIC_API_KEY on the server.", 503);
  }

  const body = evaluateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("The request is not valid: it needs the XML and at least one question.", 400);
  if (Buffer.byteLength(body.data.xml) > MAX_XML_BYTES) return error("The file is larger than 4 MB.", 413);

  const parsed = parseMismo(body.data.xml);
  if (!parsed.ok) return error(parsed.error, 422);

  try {
    return Response.json(await evaluateWithOpus(parsed.state, body.data.questions));
  } catch (cause) {
    if (cause instanceof Anthropic.AuthenticationError) return error("Anthropic rejected the API key.", 502);
    if (cause instanceof Anthropic.RateLimitError) return error("Anthropic is rate limiting requests. Try again in a moment.", 429);
    // A connection error is also an APIError, so it has to be checked first.
    if (cause instanceof Anthropic.APIConnectionError) return error("Could not reach Anthropic. Try again.", 504);
    if (cause instanceof Anthropic.APIError) return error(`Opus could not evaluate this section (${cause.status}): ${cause.message}`, 502);
    throw cause;
  }
}
