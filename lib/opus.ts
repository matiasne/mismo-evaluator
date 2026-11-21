import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Json } from "./mismo/parse";
import type { Answer, EvaluateResponse, Question } from "./questions";

const OPUS_MODEL = "claude-opus-5-5";

const SYSTEM = `You check MISMO 3.4 residential loan application files (URLA / Form 1003 data) before they are imported into a loan origination system. A wrong or missing field passes silently to everything downstream, so the point of each check is to catch it here.

The user message is JSON with three fields:
- "today": today's date.
- "mismo_loan_file": the file, converted from XML to JSON. Attributes start with "@". Empty elements were removed, so a missing key means the file has no value there. Taxpayer identifiers are masked to their last four digits; a masked value still counts as present.
- "questions": the checks to answer, each with an "id" and a "kind".

Answer every question once, using only what is in the file, and return the question's "id" and "kind" with the answer:
- kind "noul": the question is a statement about the file. Give "probability", from 0 to 1, that the statement is true. Use values near 0 or 1 when the file settles it, and values in between only when the file is ambiguous or the statement depends on a judgment call. A statement about "every" item of some kind is true when the file has no items of that kind.
- kind "choice": give "choice", copied exactly from the question's "options", and "confidence" from 0 to 1 that it is the right option.
- kind "score": the question's "levels" are ordered from worst to best. Give "level", the zero-based index of the level that fits the file, and "confidence" from 0 to 1.

Your probabilities and confidences are compared with fixed thresholds to decide whether a check passes, fails or needs a person to look, so report what you actually believe.`;

const answersSchema = z.object({
  answers: z.array(
    z.discriminatedUnion("kind", [
      z.object({ id: z.string(), kind: z.literal("noul"), probability: z.number() }),
      z.object({ id: z.string(), kind: z.literal("choice"), choice: z.string(), confidence: z.number() }),
      z.object({ id: z.string(), kind: z.literal("score"), level: z.number(), confidence: z.number() }),
    ]),
  ),
});

type OpusAnswer = z.infer<typeof answersSchema>["answers"][number];

function toPromptQuestion(question: Question) {
  const { id, kind, text } = question;
  if (kind === "choice") return { id, kind, text, options: question.options };
  if (kind === "score") return { id, kind, text, levels: question.levels };
  return { id, kind, text };
}

const unit = (value: number) => Math.min(1, Math.max(0, value));

/** Opus gives one answer and how sure it is, not a distribution, so the probabilities hold just that answer. */
function toAnswer(question: Question, answer: OpusAnswer | undefined): Answer | null {
  if (question.kind === "noul" && answer?.kind === "noul") {
    return { kind: "noul", probability: unit(answer.probability) };
  }
  if (question.kind === "choice" && answer?.kind === "choice" && question.options.includes(answer.choice)) {
    const confidence = unit(answer.confidence);
    return { kind: "choice", choice: answer.choice, confidence, probabilities: { [answer.choice]: confidence } };
  }
  if (question.kind === "score" && answer?.kind === "score") {
    const label = question.levels[answer.level];
    if (label === undefined) return null;
    const confidence = unit(answer.confidence);
    return { kind: "score", score: answer.level, label, confidence, probabilities: question.levels.map((_, level) => (level === answer.level ? confidence : 0)) };
  }
  return null;
}

/** Asks Claude Opus the same questions Jev gets, about the same state, and returns answers in the same shape. */
export async function evaluateWithOpus(state: Json, questions: Question[]): Promise<EvaluateResponse> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: OPUS_MODEL,
    // Leaves room for the model's thinking, which counts toward this limit.
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(answersSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          today: new Date().toISOString().slice(0, 10),
          mismo_loan_file: state,
          questions: questions.map(toPromptQuestion),
        }),
      },
    ],
  });

  const given = new Map(response.parsed_output?.answers.map((answer) => [answer.id, answer]));
  const answers: Record<string, Answer> = {};
  for (const question of questions) {
    const answer = toAnswer(question, given.get(question.id));
    if (answer) answers[question.id] = answer;
  }
  const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } = response.usage;
  return {
    model: response.model,
    answers,
    tokens: {
      inputTokens: input_tokens + (cache_creation_input_tokens ?? 0) + (cache_read_input_tokens ?? 0),
      outputTokens: output_tokens,
    },
  };
}
