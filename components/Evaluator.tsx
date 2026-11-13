"use client";

import { useMemo, useRef, useState } from "react";
import { MAX_XML_BYTES, parseMismo } from "@/lib/mismo/parse";
import { DEFAULT_QUESTIONS, SECTIONS, type Answer, type EvaluateResponse, type Question, type SectionKey } from "@/lib/questions";
import { useSavedQuestions } from "@/lib/questionStore";
import { QuestionForm } from "./QuestionForm";
import { ResultsPanel } from "./ResultsPanel";
import { UploadPanel } from "./UploadPanel";

export type Result =
  | { status: "running" }
  | { status: "done"; answer: Answer }
  | { status: "error"; message: string };

/** Time and tokens of one run. `ms` is null while it is still running. */
export interface RunStats {
  ms: number | null;
  inputTokens: number | null;
}

interface LoadedFile {
  name: string;
  xml: string;
}

async function evaluateSection(xml: string, questions: Question[]): Promise<EvaluateResponse> {
  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xml, questions }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? `The evaluation failed (${response.status}).`);
  return body as EvaluateResponse;
}

export function Evaluator() {
  const { saved, upsertCustom, removeCustom, setEnabled } = useSavedQuestions();
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [model, setModel] = useState<string | null>(null);
  // `undefined`: form closed. `null`: adding a new question.
  const [sectionStats, setSectionStats] = useState<Partial<Record<SectionKey, RunStats>>>({});
  // The last run is everything one click started: the whole file, or a single section.
  const [lastRun, setLastRun] = useState<RunStats | null>(null);
  const runId = useRef(0);
  const [editing, setEditing] = useState<Question | null | undefined>(undefined);

  const parsed = useMemo(() => (file ? parseMismo(file.xml) : null), [file]);
  const questions = useMemo(() => [...DEFAULT_QUESTIONS, ...saved.custom], [saved.custom]);
  const disabled = useMemo(() => new Set(saved.disabled), [saved.disabled]);
  const ready = parsed?.ok === true;
  const running = Object.values(results).some((result) => result.status === "running");

  function loadFile(name: string, xml: string) {
    setResults({});
    setModel(null);
    setSectionStats({});
    setLastRun(null);
    runId.current += 1;
    if (new Blob([xml]).size > MAX_XML_BYTES) {
      setFile(null);
      setFileError("The file is larger than 4 MB.");
      return;
    }
    setFileError(null);
    setFile({ name, xml });
  }

  function run(sections: SectionKey[]) {
    if (!file || !ready) return;
    const batches = sections
      .map((section) => ({ section, batch: questions.filter((q) => q.section === section && !disabled.has(q.id)) }))
      .filter(({ batch }) => batch.length > 0);
    if (batches.length === 0) return;

    const id = (runId.current += 1);
    const startedAt = performance.now();
    let pending = batches.length;
    let runTokens: number | null = 0;
    setLastRun({ ms: null, inputTokens: null });

    for (const { section, batch } of batches) {
      const finish = (inputTokens: number | null) => {
        setSectionStats((current) => ({ ...current, [section]: { ms: performance.now() - startedAt, inputTokens } }));
        runTokens = runTokens === null || inputTokens === null ? null : runTokens + inputTokens;
        pending -= 1;
        // A newer run, or a new file, owns the header by now.
        if (pending === 0 && runId.current === id) setLastRun({ ms: performance.now() - startedAt, inputTokens: runTokens });
      };
      const settle = (resultFor: (question: Question) => Result) =>
        setResults((current) => ({ ...current, ...Object.fromEntries(batch.map((q) => [q.id, resultFor(q)])) }));

      settle(() => ({ status: "running" }));
      evaluateSection(file.xml, batch).then(
        (response) => {
          setModel(response.model);
          finish(response.inputTokens);
          settle((q) => {
            const answer = response.answers[q.id];
            return answer ? { status: "done", answer } : { status: "error", message: "Jev returned no answer for this question." };
          });
        },
        (cause: unknown) => {
          const message = cause instanceof Error ? cause.message : "The evaluation failed.";
          settle(() => ({ status: "error", message }));
          // A failed section is not billed, so it adds nothing to the run's cost.
          finish(0);
        },
      );
    }
  }

  function forget(id: string) {
    setResults((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  return (
    <div className="columns">
      <div className="left">
        <UploadPanel
          fileName={file?.name ?? null}
          parsed={parsed}
          error={fileError}
          running={running}
          lastRun={lastRun}
          onFile={loadFile}
          onError={setFileError}
          onEvaluate={() => run(SECTIONS.map((s) => s.key))}
        />
      </div>
      <div>
        {editing !== undefined && (
          <QuestionForm
            key={editing?.id ?? "new"}
            question={editing}
            onCancel={() => setEditing(undefined)}
            onSave={(question) => {
              upsertCustom(question);
              forget(question.id);
              setEditing(undefined);
            }}
          />
        )}
        <ResultsPanel
          questions={questions}
          disabled={disabled}
          results={results}
          model={model}
          sectionStats={sectionStats}
          canRun={ready}
          onRunSection={(section) => run([section])}
          onToggle={(id, enabled) => {
            setEnabled(id, enabled);
            if (!enabled) forget(id);
          }}
          onAdd={() => setEditing(null)}
          onEdit={setEditing}
          onDelete={(id) => {
            removeCustom(id);
            forget(id);
          }}
        />
      </div>
    </div>
  );
}
