"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ENGINES, engineLabel, formatDuration, formatUsdAmount, costUsd, type Engine, type Tokens } from "@/lib/cost";
import { MAX_XML_BYTES, parseMismo } from "@/lib/mismo/parse";
import { DEFAULT_QUESTIONS, SECTIONS, type Answer, type EvaluateResponse, type Question, type SectionKey } from "@/lib/questions";
import { useSavedQuestions } from "@/lib/questionStore";
import { toSummaryCheck, type SummaryResponse } from "@/lib/summary";
import { QuestionForm } from "./QuestionForm";
import { ResultsPanel } from "./ResultsPanel";
import { SummaryPanel, type Summary } from "./SummaryPanel";
import { UploadPanel } from "./UploadPanel";

export type Result =
  | { status: "running" }
  | { status: "done"; answer: Answer }
  | { status: "error"; message: string };

/** Time and tokens of one run. `ms` is null while it is still running; `tokens` is null when the API did not report them. */
export interface RunStats {
  ms: number | null;
  tokens: Tokens | null;
}

/** Everything one engine has produced for the file on screen. */
interface EngineState {
  results: Record<string, Result>;
  model: string | null;
  sectionStats: Partial<Record<SectionKey, RunStats>>;
  // The last run is everything one click started: the whole file, or a single section.
  lastRun: RunStats | null;
}

interface LoadedFile {
  name: string;
  xml: string;
}

const ALL_SECTIONS = SECTIONS.map((s) => s.key);
const ALL_ENGINES = ENGINES.map((e) => e.key);
const ENDPOINT: Record<Engine, string> = { jev: "/api/evaluate", haiku: "/api/evaluate-haiku" };
const NOT_RUN: EngineState = { results: {}, model: null, sectionStats: {}, lastRun: null };

const isRunning = (state: EngineState) => Object.values(state.results).some((result) => result.status === "running");

async function evaluateSection(engine: Engine, xml: string, questions: Question[]): Promise<EvaluateResponse> {
  const response = await fetch(ENDPOINT[engine], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xml, questions }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? `The evaluation failed (${response.status}).`);
  return body as EvaluateResponse;
}

async function summarize(body: string, signal: AbortSignal): Promise<SummaryResponse> {
  const response = await fetch("/api/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error ?? `The summary failed (${response.status}).`);
  return json as SummaryResponse;
}

export function Evaluator() {
  const { saved, upsertCustom, removeCustom, setEnabled } = useSavedQuestions();
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [engines, setEngines] = useState<Record<Engine, EngineState>>({ jev: NOT_RUN, haiku: NOT_RUN });
  // The engine whose results are on screen.
  const [tab, setTab] = useState<Engine>("jev");
  const runId = useRef<Record<Engine, number>>({ jev: 0, haiku: 0 });
  // `undefined`: form closed. `null`: adding a new question.
  const [editing, setEditing] = useState<Question | null | undefined>(undefined);

  const parsed = useMemo(() => (file ? parseMismo(file.xml) : null), [file]);
  const questions = useMemo(() => [...DEFAULT_QUESTIONS, ...saved.custom], [saved.custom]);
  const disabled = useMemo(() => new Set(saved.disabled), [saved.disabled]);
  const ready = parsed?.ok === true;
  const running = isRunning(engines.jev) || isRunning(engines.haiku);
  const shown = engines[tab];
  const other: Engine = tab === "jev" ? "haiku" : "jev";

  // The summary is written from Jev's answers: null while Jev is running or has answered nothing.
  const { results } = engines.jev;
  const jevRunning = isRunning(engines.jev);
  const summaryBody = useMemo(() => {
    if (jevRunning) return null;
    const checks = questions.flatMap((question) => {
      const result = results[question.id];
      return result?.status === "done" ? toSummaryCheck(question, result.answer) : [];
    });
    return checks.length > 0 ? JSON.stringify({ checks }) : null;
  }, [jevRunning, questions, results]);
  // Kept with the request it answers, so a summary of older results is never shown as current.
  const [summarized, setSummarized] = useState<{ body: string; summary: Summary } | null>(null);
  const summary: Summary | null =
    summaryBody === null ? null : summarized?.body === summaryBody ? summarized.summary : { status: "loading" };

  useEffect(() => {
    if (summaryBody === null) return;
    const controller = new AbortController();
    const startedAt = performance.now();
    summarize(summaryBody, controller.signal).then(
      ({ summary: text, model, inputTokens, outputTokens }) =>
        setSummarized({ body: summaryBody, summary: { status: "done", text, model, ms: performance.now() - startedAt, inputTokens, outputTokens } }),
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : "The summary failed.";
        setSummarized({ body: summaryBody, summary: { status: "error", message } });
      },
    );
    return () => controller.abort();
  }, [summaryBody]);

  function loadFile(name: string, xml: string) {
    setEngines({ jev: NOT_RUN, haiku: NOT_RUN });
    for (const engine of ALL_ENGINES) runId.current[engine] += 1;
    if (new Blob([xml]).size > MAX_XML_BYTES) {
      setFile(null);
      setFileError("The file is larger than 4 MB.");
      return;
    }
    setFileError(null);
    setFile({ name, xml });
  }

  // `xml` is passed in when the file was loaded in this same click and is not in state yet.
  function run(engine: Engine, sections: SectionKey[], xml = ready ? file?.xml : undefined) {
    if (xml === undefined) return;
    const batches = sections
      .map((section) => ({ section, batch: questions.filter((q) => q.section === section && !disabled.has(q.id)) }))
      .filter(({ batch }) => batch.length > 0);
    if (batches.length === 0) return;

    const id = (runId.current[engine] += 1);
    const startedAt = performance.now();
    let pending = batches.length;
    let runTokens: Tokens | null = { inputTokens: 0, outputTokens: 0 };
    const update = (change: (state: EngineState) => EngineState) =>
      setEngines((current) => ({ ...current, [engine]: change(current[engine]) }));
    update((state) => ({ ...state, lastRun: { ms: null, tokens: null } }));

    for (const { section, batch } of batches) {
      // Sets the section's results and stats together, and the run's stats once its last section is in.
      const settle = (resultFor: (question: Question) => Result, tokens: Tokens | null, model?: string) => {
        const ms = performance.now() - startedAt;
        runTokens =
          runTokens === null || tokens === null
            ? null
            : { inputTokens: runTokens.inputTokens + tokens.inputTokens, outputTokens: runTokens.outputTokens + tokens.outputTokens };
        pending -= 1;
        // A newer run, or a new file, owns the header by now.
        const lastRun = pending === 0 && runId.current[engine] === id ? { ms, tokens: runTokens } : null;
        update((state) => ({
          results: { ...state.results, ...Object.fromEntries(batch.map((q) => [q.id, resultFor(q)])) },
          model: model ?? state.model,
          sectionStats: { ...state.sectionStats, [section]: { ms, tokens } },
          lastRun: lastRun ?? state.lastRun,
        }));
      };

      update((state) => ({
        ...state,
        results: { ...state.results, ...Object.fromEntries(batch.map((q) => [q.id, { status: "running" }])) },
      }));
      evaluateSection(engine, xml, batch).then(
        (response) =>
          settle(
            (q) => {
              const answer = response.answers[q.id];
              return answer ? { status: "done", answer } : { status: "error", message: `${engineLabel(engine)} returned no answer for this question.` };
            },
            response.tokens,
            response.model,
          ),
        (cause: unknown) => {
          const message = cause instanceof Error ? cause.message : "The evaluation failed.";
          // A failed section is not billed, so it adds nothing to the run's cost.
          settle(() => ({ status: "error", message }), { inputTokens: 0, outputTokens: 0 });
        },
      );
    }
  }

  // One click evaluates the file with both engines, so their time and cost can be compared.
  function runAll(xml?: string) {
    for (const engine of ALL_ENGINES) run(engine, ALL_SECTIONS, xml);
  }

  function forget(id: string) {
    const without = (state: EngineState): EngineState => {
      const results = { ...state.results };
      delete results[id];
      return { ...state, results };
    };
    setEngines((current) => ({ jev: without(current.jev), haiku: without(current.haiku) }));
  }

  return (
    <div className="columns">
      <div className="left">
        <UploadPanel
          fileName={file?.name ?? null}
          parsed={parsed}
          error={fileError}
          running={running}
          engine={tab}
          lastRun={shown.lastRun}
          onFile={loadFile}
          onSample={(name, xml) => {
            loadFile(name, xml);
            if (parseMismo(xml).ok) runAll(xml);
          }}
          onError={setFileError}
          onEvaluate={() => runAll()}
        />
        {summary && <SummaryPanel summary={summary} />}
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
        <div className="tabs" role="tablist" aria-label="Evaluated with">
          {ENGINES.map(({ key, label }) => {
            const { lastRun } = engines[key];
            return (
              <button key={key} className="tab" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
                <strong>{label}</strong>
                <span className="muted small">
                  {lastRun === null ? (
                    "Not run"
                  ) : lastRun.ms === null ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Evaluating
                    </>
                  ) : (
                    `${formatDuration(lastRun.ms)} · ${lastRun.tokens ? formatUsdAmount(costUsd(key, lastRun.tokens)) : "cost not reported"}`
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <ResultsPanel
          engine={tab}
          questions={questions}
          disabled={disabled}
          results={shown.results}
          compare={{ engine: other, results: engines[other].results }}
          model={shown.model}
          sectionStats={shown.sectionStats}
          canRun={ready}
          onRunSection={(section) => run(tab, [section])}
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
