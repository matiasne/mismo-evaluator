import { z } from "zod";
import { SECTIONS, type Answer, type Question } from "./questions";
import { verdictFor } from "./verdict";

const checkSchema = z.object({
  section: z.string().max(60),
  question: z.string().max(500),
  answer: z.string().max(200),
  verdict: z.enum(["pass", "review", "fail", "info"]),
});

export type SummaryCheck = z.infer<typeof checkSchema>;

/** The request body of POST /api/summary. Only the results are sent, never the file. */
export const summaryRequestSchema = z.object({ checks: z.array(checkSchema).min(1).max(300) });

export interface SummaryResponse {
  summary: string;
  /** The Claude model that wrote it, as the API reports it. */
  model: string;
  /** Tokens Claude billed for this request. Output includes the model's thinking. */
  inputTokens: number;
  outputTokens: number;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

function describeAnswer(answer: Answer): string {
  if (answer.kind === "noul") return `${answer.probability >= 0.5 ? "True" : "False"} (${percent(answer.probability)} probability it is true)`;
  return `${answer.kind === "choice" ? answer.choice : answer.label} (${percent(answer.confidence)} confidence)`;
}

/** One answered question, in the words the summary model reads. */
export function toSummaryCheck(question: Question, answer: Answer): SummaryCheck {
  return {
    section: SECTIONS.find((section) => section.key === question.section)?.label ?? question.section,
    question: question.text,
    answer: describeAnswer(answer),
    verdict: verdictFor(question, answer),
  };
}
