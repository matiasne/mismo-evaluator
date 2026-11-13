"use client";

import { useState } from "react";
import { SECTIONS, type Answer, type Question, type SectionKey } from "@/lib/questions";
import { countVerdicts, verdictFor, type Verdict } from "@/lib/verdict";
import type { Result } from "./Evaluator";

interface Props {
  questions: Question[];
  disabled: Set<string>;
  results: Record<string, Result>;
  model: string | null;
  canRun: boolean;
  onRunSection: (section: SectionKey) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onAdd: () => void;
  onEdit: (question: Question) => void;
  onDelete: (id: string) => void;
}

const VERDICT_LABEL: Record<Verdict, string> = { pass: "Pass", review: "Review", fail: "Fail", info: "Answer" };
const KIND_LABEL: Record<Question["kind"], string> = { noul: "True / false", choice: "Choice", score: "Score" };
const FILTERS: (Verdict | "all")[] = ["all", "fail", "review", "pass"];

const percent = (value: number) => `${Math.round(value * 100)}%`;

function Meter({ value }: { value: number }) {
  return (
    <span className="meter" aria-hidden="true">
      <span style={{ width: percent(Math.min(1, Math.max(0, value))) }} />
    </span>
  );
}

function AnswerLine({ answer }: { answer: Answer }) {
  if (answer.kind === "noul") {
    return (
      <>
        <strong>{answer.probability >= 0.5 ? "True" : "False"}</strong>
        <Meter value={answer.probability} />
        <span>{percent(answer.probability)} probability it is true</span>
      </>
    );
  }
  return (
    <>
      <strong>{answer.kind === "choice" ? answer.choice : answer.label}</strong>
      <Meter value={answer.confidence} />
      <span>{percent(answer.confidence)} confidence</span>
    </>
  );
}

export function ResultsPanel(props: Props) {
  const { questions, disabled, results, model, canRun } = props;
  const [filter, setFilter] = useState<Verdict | "all">("all");

  const verdictOf = (question: Question): Verdict | null => {
    const result = results[question.id];
    return result?.status === "done" ? verdictFor(question, result.answer) : null;
  };
  const totals = countVerdicts(questions.flatMap((q) => verdictOf(q) ?? []));
  const answered = totals.pass + totals.review + totals.fail + totals.info;

  return (
    <>
      <section className="panel">
        <div className="toolbar">
          <div>
            <h2 style={{ margin: 0 }}>Results</h2>
            <p className="muted small">
              {answered === 0
                ? "Upload a file and evaluate it to see Jev's answer to each question."
                : `${totals.pass} passed, ${totals.review} to review, ${totals.fail} failed${model ? ` · ${model}` : ""}`}
            </p>
          </div>
          <button className="btn" onClick={props.onAdd}>Add question</button>
        </div>
        <div className="filters" role="group" aria-label="Filter by result">
          {FILTERS.map((option) => (
            <button key={option} className="chip" aria-pressed={filter === option} onClick={() => setFilter(option)}>
              {option === "all" ? "All" : `${VERDICT_LABEL[option]} (${totals[option]})`}
            </button>
          ))}
        </div>
      </section>

      {SECTIONS.map((section) => {
        const inSection = questions.filter((q) => q.section === section.key);
        const shown = inSection.filter((q) => filter === "all" || verdictOf(q) === filter);
        if (shown.length === 0) return null;
        const counts = countVerdicts(inSection.flatMap((q) => verdictOf(q) ?? []));
        const busy = inSection.some((q) => results[q.id]?.status === "running");

        return (
          <section className="panel" key={section.key}>
            <div className="section-head">
              <h2>{section.label}</h2>
              <div className="counts">
                {(["fail", "review", "pass"] as const).map(
                  (verdict) =>
                    counts[verdict] > 0 && (
                      <span key={verdict} className={`badge ${verdict}`}>
                        {counts[verdict]} {VERDICT_LABEL[verdict].toLowerCase()}
                      </span>
                    ),
                )}
                <button className="btn small" disabled={!canRun || busy} onClick={() => props.onRunSection(section.key)}>
                  {busy ? "Running…" : "Run"}
                </button>
              </div>
            </div>
            <ul className="questions">
              {shown.map((question) => {
                const result = results[question.id];
                const verdict = verdictOf(question);
                const off = disabled.has(question.id);
                return (
                  <li key={question.id} className={off ? "question off" : "question"}>
                    <span>
                      {verdict ? (
                        <span className={`badge ${verdict}`}>{VERDICT_LABEL[verdict]}</span>
                      ) : (
                        <span className="badge idle">
                          {off ? "Off" : result?.status === "running" ? "Running" : result?.status === "error" ? "Error" : "Not run"}
                        </span>
                      )}
                    </span>
                    <span className="question-text">{question.text}</span>
                    <span className="question-tools">
                      <span className="muted">{KIND_LABEL[question.kind]}</span>
                      {question.custom ? (
                        <>
                          <button className="btn link" onClick={() => props.onEdit(question)}>Edit</button>
                          <button className="btn link" onClick={() => props.onDelete(question.id)}>Delete</button>
                        </>
                      ) : (
                        <label>
                          <input
                            type="checkbox"
                            checked={!off}
                            onChange={(event) => props.onToggle(question.id, event.target.checked)}
                          />{" "}
                          On
                        </label>
                      )}
                    </span>
                    {result?.status === "done" && (
                      <span className="question-answer">
                        <AnswerLine answer={result.answer} />
                      </span>
                    )}
                    {result?.status === "error" && <span className="question-answer">{result.message}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
