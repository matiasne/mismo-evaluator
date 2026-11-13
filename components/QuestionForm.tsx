"use client";

import { useState } from "react";
import { questionSchema, SECTIONS, type Question, type QuestionKind, type SectionKey } from "@/lib/questions";

interface Props {
  /** The question to edit, or null to add a new one. */
  question: Question | null;
  onSave: (question: Question) => void;
  onCancel: () => void;
}

const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

export function QuestionForm({ question, onSave, onCancel }: Props) {
  const [section, setSection] = useState<SectionKey>(question?.section ?? "file");
  const [kind, setKind] = useState<QuestionKind>(question?.kind ?? "noul");
  const [text, setText] = useState(question?.text ?? "");
  const [expectedTrue, setExpectedTrue] = useState(question?.kind === "noul" ? question.expected : true);
  const [options, setOptions] = useState(question?.kind === "choice" ? question.options.join("\n") : "");
  const [expectedOption, setExpectedOption] = useState(question?.kind === "choice" ? (question.expected ?? "") : "");
  const [levels, setLevels] = useState(question?.kind === "score" ? question.levels.join("\n") : "");
  const [minLevel, setMinLevel] = useState(question?.kind === "score" && question.minLevel !== undefined ? String(question.minLevel) : "");
  const [error, setError] = useState<string | null>(null);

  const optionList = lines(options);
  const levelList = lines(levels);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const base = { id: question?.id ?? `custom-${crypto.randomUUID()}`, section, text, custom: true };
    const draft =
      kind === "noul"
        ? { ...base, kind, expected: expectedTrue }
        : kind === "choice"
          ? { ...base, kind, options: optionList, expected: optionList.includes(expectedOption) ? expectedOption : undefined }
          : { ...base, kind, levels: levelList, minLevel: minLevel !== "" && Number(minLevel) < levelList.length ? Number(minLevel) : undefined };

    const parsed = questionSchema.safeParse(draft);
    if (!parsed.success) {
      setError(
        kind === "noul"
          ? "Write the question (3 to 500 characters)."
          : `Write the question and at least two ${kind === "choice" ? "options" : "levels"}, one per line.`,
      );
      return;
    }
    onSave(parsed.data);
  }

  return (
    <section className="panel">
      <h2>{question ? "Edit question" : "Add a question"}</h2>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Section
            <select value={section} onChange={(event) => setSection(event.target.value as SectionKey)}>
              {SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
          <label>
            Answer type
            <select value={kind} onChange={(event) => setKind(event.target.value as QuestionKind)}>
              <option value="noul">True / false</option>
              <option value="choice">Choice from a list</option>
              <option value="score">Score on a scale</option>
            </select>
          </label>
        </div>

        <label>
          {kind === "noul" ? "Statement or yes/no question about the file" : "Question about the file"}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={kind === "noul" ? "Every borrower has at least two years of employment history." : "What type of property is the subject property?"}
          />
        </label>

        {kind === "noul" && (
          <label>
            A healthy file answers
            <select value={expectedTrue ? "true" : "false"} onChange={(event) => setExpectedTrue(event.target.value === "true")}>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </label>
        )}

        {kind === "choice" && (
          <div className="form-grid">
            <label>
              Options, one per line
              <textarea value={options} onChange={(event) => setOptions(event.target.value)} />
            </label>
            <label>
              Expected answer
              <select value={optionList.includes(expectedOption) ? expectedOption : ""} onChange={(event) => setExpectedOption(event.target.value)}>
                <option value="">None, just show the answer</option>
                {optionList.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {kind === "score" && (
          <div className="form-grid">
            <label>
              Levels from worst to best, one per line
              <textarea value={levels} onChange={(event) => setLevels(event.target.value)} />
            </label>
            <label>
              Lowest level that passes
              <select value={minLevel !== "" && Number(minLevel) < levelList.length ? minLevel : ""} onChange={(event) => setMinLevel(event.target.value)}>
                <option value="">None, just show the score</option>
                {levelList.map((level, index) => (
                  <option key={index} value={index}>{level}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {error && <p className="alert" role="alert" style={{ marginTop: 0 }}>{error}</p>}

        <div className="row-actions" style={{ marginTop: 0 }}>
          <button className="btn primary" type="submit">{question ? "Save question" : "Add question"}</button>
          <button className="btn" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  );
}
