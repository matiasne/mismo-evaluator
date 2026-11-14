# MISMO file evaluator

Upload a MISMO 3.4 loan application (the URLA / Form 1003 export from Encompass, Byte, Calyx and similar) and have it checked before it is imported. Each check is a typed question answered by [Jev](https://docs.typesafe.ai), TypeSafe AI's System One model. The file goes on the left, the answer to every question on the right, and you can add your own questions.

## Run it

Needs Node.js 22 or newer and a TypeSafe API key.

```sh
npm install
cp .env.example .env.local   # then set TYPESAFE_API_KEY
npm run dev                  # http://localhost:3000
```

"Try the sample" loads and evaluates `public/samples/sample-urla.xml`, a synthetic file with a few planted defects (a state spelled out, an employer with no name, a liability with no monthly payment, a co-borrower with no declarations, an asset linked to nobody).

## Deploy to Vercel

Import the repository in Vercel (or run `vercel`), and set the `TYPESAFE_API_KEY` environment variable. Optionally set `JEV_MODEL` (defaults to `jev-latest`). No other configuration is needed.

## How it works

1. The browser reads the XML (up to 4 MB) and shows a summary of what is in it.
2. For each section, the browser posts the XML and that section's questions to `POST /api/evaluate`.
3. The server parses the XML into compact JSON (`lib/mismo/parse.ts`): namespaces and empty nodes are dropped, relationships are kept, and SSNs are masked to their last four digits. Nothing is stored.
4. The server sends that state and the questions to Jev (`lib/jev.ts`).
5. Code turns each answer into a verdict (`lib/verdict.ts`):
   - True / false: the probability on the expected side must be at least 80% to pass; 50% to 80% is "review"; lower fails.
   - Choice and score: confidence under 60% is "review"; otherwise the answer is compared with the expected one, if the question has one.

Two blocks under the upload box show how long the last run took and what it cost. Cost is Jev's reported input tokens times the list price in `lib/cost.ts` ($0.042 per million input tokens, output free); update that constant if your pricing differs.

## Questions

The default questions are in `lib/questions.ts`, grouped by section. In the app you can switch a default off, and add, edit or delete your own. Your questions are saved in your browser (`localStorage`), not on a server, so they do not follow you to another browser.

## Checks

```sh
npm test          # parser and verdict tests
npm run lint
npm run typecheck
npm run build
```
