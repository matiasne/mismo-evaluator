import { Evaluator } from "@/components/Evaluator";

export default function Page() {
  return (
    <main className="page">
      <header className="page-header">
        <h1>MISMO file evaluator</h1>
        <p>Upload a MISMO 3.4 loan application and Jev checks it, question by question, before it is imported. Claude Opus runs the same checks, so you can compare the two.</p>
      </header>
      <Evaluator />
    </main>
  );
}
