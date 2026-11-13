import { APIConnectionError, APIError, AuthenticationError, RateLimitError } from "@typesafe-ai/sdk";
import { evaluateWithJev } from "@/lib/jev";
import { MAX_XML_BYTES, parseMismo } from "@/lib/mismo/parse";
import { evaluateRequestSchema } from "@/lib/questions";

export const runtime = "nodejs";
export const maxDuration = 60;

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request): Promise<Response> {
  if (!process.env.TYPESAFE_API_KEY) {
    return error("The TypeSafe API key is not configured. Set TYPESAFE_API_KEY on the server.", 503);
  }

  const body = evaluateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("The request is not valid: it needs the XML and at least one question.", 400);
  if (Buffer.byteLength(body.data.xml) > MAX_XML_BYTES) return error("The file is larger than 4 MB.", 413);

  const parsed = parseMismo(body.data.xml);
  if (!parsed.ok) return error(parsed.error, 422);

  try {
    return Response.json(await evaluateWithJev(parsed.state, parsed.approxTokens, body.data.questions));
  } catch (cause) {
    if (cause instanceof AuthenticationError) return error("TypeSafe rejected the API key.", 502);
    if (cause instanceof RateLimitError) return error("TypeSafe is rate limiting requests. Try again in a moment.", 429);
    if (cause instanceof APIError) return error(`Jev could not evaluate this section (${cause.status}): ${cause.message}`, 502);
    if (cause instanceof APIConnectionError) return error("Could not reach TypeSafe. Try again.", 504);
    throw cause;
  }
}
