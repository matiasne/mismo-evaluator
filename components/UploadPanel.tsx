"use client";

import { useState } from "react";
import type { ParseResult } from "@/lib/mismo/parse";

interface Props {
  fileName: string | null;
  parsed: ParseResult | null;
  error: string | null;
  running: boolean;
  onFile: (name: string, xml: string) => void;
  onError: (message: string) => void;
  onEvaluate: () => void;
}

const SAMPLE = "/samples/sample-urla.xml";

const money = (value: string | null) => {
  const amount = Number(value);
  return value && Number.isFinite(amount)
    ? amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : (value ?? "Not stated");
};

export function UploadPanel({ fileName, parsed, error, running, onFile, onError, onEvaluate }: Props) {
  const [over, setOver] = useState(false);

  async function read(file: File | undefined) {
    if (!file) return;
    try {
      onFile(file.name, await file.text());
    } catch {
      onError("The file could not be read.");
    }
  }

  async function loadSample() {
    try {
      const response = await fetch(SAMPLE);
      if (!response.ok) throw new Error();
      onFile("sample-urla.xml", await response.text());
    } catch {
      onError("The sample file could not be loaded.");
    }
  }

  const problem = error ?? (parsed && !parsed.ok ? parsed.error : null);

  return (
    <>
      <section className="panel">
        <h2>MISMO file</h2>
        <label
          className={over ? "dropzone over" : "dropzone"}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            void read(event.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(event) => {
              void read(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <strong>{fileName ?? "Choose a MISMO 3.4 XML file"}</strong>
          {fileName ? "Choose another file or drop it here" : "or drop it here (up to 4 MB)"}
        </label>

        {problem && <p className="alert" role="alert">{problem}</p>}

        <div className="row-actions">
          <button className="btn primary" disabled={!parsed?.ok || running} onClick={onEvaluate}>
            {running ? "Evaluating…" : "Evaluate with Jev"}
          </button>
          <button className="btn" onClick={() => void loadSample()}>Try the sample</button>
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          The file is not stored. SSNs are masked before the data is sent to Jev.
        </p>
      </section>

      {parsed?.ok && (
        <section className="panel">
          <h2>What is in the file</h2>
          <dl className="kv">
            <dt>MISMO version</dt>
            <dd>{parsed.summary.version ?? "Not stated"}</dd>
            <dt>Borrowers</dt>
            <dd>{parsed.summary.borrowers.join(", ") || "None"}</dd>
            <dt>Loan purpose</dt>
            <dd>{parsed.summary.loanPurpose ?? "Not stated"}</dd>
            <dt>Mortgage type</dt>
            <dd>{parsed.summary.mortgageType ?? "Not stated"}</dd>
            <dt>Loan amount</dt>
            <dd>{money(parsed.summary.noteAmount)}</dd>
            <dt>Employers</dt>
            <dd>{parsed.summary.counts.employers}</dd>
            <dt>Income items</dt>
            <dd>{parsed.summary.counts.incomeItems}</dd>
            <dt>Assets</dt>
            <dd>{parsed.summary.counts.assets}</dd>
            <dt>Owned properties</dt>
            <dd>{parsed.summary.counts.ownedProperties}</dd>
            <dt>Liabilities</dt>
            <dd>{parsed.summary.counts.liabilities}</dd>
            <dt>Declarations</dt>
            <dd>
              {parsed.summary.counts.declarations} of {parsed.summary.borrowers.length} borrowers
            </dd>
          </dl>
        </section>
      )}
    </>
  );
}
