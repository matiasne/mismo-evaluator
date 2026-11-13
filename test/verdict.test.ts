import { describe, expect, it } from "vitest";
import { DEFAULT_QUESTIONS, questionSchema, type Question } from "../lib/questions";
import { countVerdicts, verdictFor } from "../lib/verdict";

const base = { id: "q", section: "file" as const, text: "A question" };
const noul = (expected: boolean): Question => ({ ...base, kind: "noul", expected });

describe("verdictFor", () => {
  it("grades a true/false answer against the expected side", () => {
    expect(verdictFor(noul(true), { kind: "noul", probability: 0.95 })).toBe("pass");
    expect(verdictFor(noul(true), { kind: "noul", probability: 0.8 })).toBe("pass");
    expect(verdictFor(noul(true), { kind: "noul", probability: 0.65 })).toBe("review");
    expect(verdictFor(noul(true), { kind: "noul", probability: 0.2 })).toBe("fail");
    expect(verdictFor(noul(false), { kind: "noul", probability: 0.05 })).toBe("pass");
    expect(verdictFor(noul(false), { kind: "noul", probability: 0.9 })).toBe("fail");
  });

  it("grades a choice by confidence, then by the expected option", () => {
    const answer = { kind: "choice" as const, choice: "Purchase", confidence: 0.9, probabilities: {} };
    const question: Question = { ...base, kind: "choice", options: ["Purchase", "Refinance"] };
    expect(verdictFor(question, answer)).toBe("info");
    expect(verdictFor({ ...question, expected: "Purchase" }, answer)).toBe("pass");
    expect(verdictFor({ ...question, expected: "Refinance" }, answer)).toBe("fail");
    expect(verdictFor({ ...question, expected: "Purchase" }, { ...answer, confidence: 0.4 })).toBe("review");
  });

  it("grades a score against the lowest passing level", () => {
    const answer = { kind: "score" as const, score: 1, label: "partial", confidence: 0.9, probabilities: [] };
    const question: Question = { ...base, kind: "score", levels: ["missing", "partial", "complete"] };
    expect(verdictFor(question, answer)).toBe("info");
    expect(verdictFor({ ...question, minLevel: 1 }, answer)).toBe("pass");
    expect(verdictFor({ ...question, minLevel: 2 }, answer)).toBe("fail");
  });

  it("counts verdicts", () => {
    expect(countVerdicts(["pass", "pass", "fail"])).toEqual({ pass: 2, review: 0, fail: 1, info: 0 });
  });
});

describe("default questions", () => {
  it("are valid and have unique ids", () => {
    for (const question of DEFAULT_QUESTIONS) expect(questionSchema.safeParse(question).success).toBe(true);
    expect(new Set(DEFAULT_QUESTIONS.map((q) => q.id)).size).toBe(DEFAULT_QUESTIONS.length);
  });
});
