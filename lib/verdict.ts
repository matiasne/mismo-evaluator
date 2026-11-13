import type { Answer, Question } from "./questions";

/** `info` means Jev answered but the question has no expected answer to compare with. */
export type Verdict = "pass" | "review" | "fail" | "info";

export const PASS_PROBABILITY = 0.8;
export const REVIEW_PROBABILITY = 0.5;
export const MIN_CONFIDENCE = 0.6;

/** Jev judges, code decides: turns an answer into a verdict using fixed thresholds. */
export function verdictFor(question: Question, answer: Answer): Verdict {
  if (question.kind === "noul" && answer.kind === "noul") {
    const onExpectedSide = question.expected ? answer.probability : 1 - answer.probability;
    if (onExpectedSide >= PASS_PROBABILITY) return "pass";
    return onExpectedSide >= REVIEW_PROBABILITY ? "review" : "fail";
  }
  if (question.kind === "choice" && answer.kind === "choice") {
    if (answer.confidence < MIN_CONFIDENCE) return "review";
    if (question.expected === undefined) return "info";
    return answer.choice === question.expected ? "pass" : "fail";
  }
  if (question.kind === "score" && answer.kind === "score") {
    if (answer.confidence < MIN_CONFIDENCE) return "review";
    if (question.minLevel === undefined) return "info";
    return answer.score >= question.minLevel ? "pass" : "fail";
  }
  return "review";
}

export function countVerdicts(verdicts: Verdict[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = { pass: 0, review: 0, fail: 0, info: 0 };
  for (const verdict of verdicts) counts[verdict] += 1;
  return counts;
}
