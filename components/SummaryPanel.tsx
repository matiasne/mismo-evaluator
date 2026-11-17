import { formatDuration, formatUsdAmount, summaryCostUsd } from "@/lib/cost";

export type Summary =
  | { status: "loading" }
  | { status: "done"; text: string; ms: number; inputTokens: number; outputTokens: number }
  | { status: "error"; message: string };

const tokens = (count: number) => count.toLocaleString("en-US");

export function SummaryPanel({ summary }: { summary: Summary }) {
  return (
    <section className="panel" aria-live="polite">
      <h2>Summary</h2>
      {summary.status === "loading" && (
        <p className="muted">
          <span className="spinner" aria-hidden="true" /> Writing the summary…
        </p>
      )}
      {summary.status === "done" && <p className="summary-text">{summary.text}</p>}
      {summary.status === "error" && <p className="alert" role="alert" style={{ marginTop: 0 }}>{summary.message}</p>}
      {summary.status !== "error" && (
        <div className="stats">
          <div className="stat">
            <h3>Time</h3>
            <p className="stat-value">
              {summary.status === "loading" ? <span className="spinner" aria-hidden="true" /> : formatDuration(summary.ms)}
            </p>
            <p className="muted small">{summary.status === "loading" ? "Writing" : "Summary generation"}</p>
          </div>
          <div className="stat">
            <h3>Cost</h3>
            <p className="stat-value">
              {summary.status === "loading" ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                formatUsdAmount(summaryCostUsd(summary.inputTokens, summary.outputTokens))
              )}
            </p>
            <p className="muted small">
              {summary.status === "loading" ? "Tokens" : `${tokens(summary.inputTokens)} in · ${tokens(summary.outputTokens)} out`}
            </p>
          </div>
        </div>
      )}
      <p className="muted small" style={{ marginTop: 10 }}>
        Written by Claude from the results. The file itself is not sent to Claude.
      </p>
    </section>
  );
}
