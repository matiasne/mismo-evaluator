import { choice, noul, score, TypeSafeClient, type Questions } from "@typesafe-ai/sdk";
import type { Json } from "./mismo/parse";
import type { Answer, EvaluateResponse, Question } from "./questions";

// Jev's default per-question context is 32k tokens; above this we ask for the long context.
const LONG_CONTEXT_FROM_TOKENS = 24_000;

function toJevQuestion(question: Question): Questions[string] {
  if (question.kind === "choice") {
    return choice(question.text, Object.fromEntries(question.options.map((option) => [option, null])));
  }
  if (question.kind === "score") return score(question.text, question.levels);
  return noul(question.text);
}

/** Asks Jev every question about the same state and returns the answers keyed by question id. */
export async function evaluateWithJev(state: Json, approxTokens: number, questions: Question[]): Promise<EvaluateResponse> {
  const client = new TypeSafeClient();
  const result = await client.systemOne(
    {
      state: { today: new Date().toISOString().slice(0, 10), mismo_loan_file: state },
      questions: Object.fromEntries(questions.map((question) => [question.id, toJevQuestion(question)])),
      model: process.env.JEV_MODEL || "jev-latest",
    },
    approxTokens > LONG_CONTEXT_FROM_TOKENS ? { headers: { "TypeSafe-Danger-Zone-Long-Context": "true" } } : undefined,
  );

  const answers: Record<string, Answer> = {};
  for (const question of questions) {
    const answer = result.answers[question.id];
    if (answer?.type === "noul") {
      answers[question.id] = { kind: "noul", probability: answer.noul };
    } else if (answer?.type === "choice") {
      answers[question.id] = { kind: "choice", choice: answer.choice, confidence: answer.confidence, probabilities: { ...answer.probabilities } };
    } else if (answer?.type === "score" && question.kind === "score") {
      const probabilities = answer.probabilities as Record<string, number>;
      answers[question.id] = {
        kind: "score",
        score: answer.score,
        label: question.levels[answer.score] ?? String(answer.score),
        confidence: answer.confidence,
        probabilities: question.levels.map((_, level) => probabilities[level] ?? 0),
      };
    }
  }
  // Jev does not bill output tokens.
  const inputTokens = result.usage?.input_tokens ?? null;
  return { model: result.model, answers, tokens: inputTokens === null ? null : { inputTokens, outputTokens: 0 } };
}
