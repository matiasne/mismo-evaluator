import { z } from "zod";

export const SECTIONS = [
  { key: "file", label: "File integrity" },
  { key: "borrowers", label: "Borrowers" },
  { key: "income", label: "Income and employment" },
  { key: "assets", label: "Assets" },
  { key: "liabilities", label: "Liabilities" },
  { key: "declarations", label: "Declarations" },
  { key: "property", label: "Property and loan terms" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];
const sectionKeys = SECTIONS.map((s) => s.key) as [SectionKey, ...SectionKey[]];

const text = z.string().trim().min(3).max(500);
const label = z.string().trim().min(1).max(120);
const base = { id: z.string().min(1).max(80), section: z.enum(sectionKeys), text, custom: z.boolean().optional() };

export const questionSchema = z.discriminatedUnion("kind", [
  // A statement about the file. `expected` is the answer a healthy file gives.
  z.object({ ...base, kind: z.literal("noul"), expected: z.boolean() }),
  z.object({ ...base, kind: z.literal("choice"), options: z.array(label).min(2).max(12), expected: label.optional() }),
  // Levels go from worst to best. `minLevel` is the lowest level index that passes.
  z.object({ ...base, kind: z.literal("score"), levels: z.array(label).min(2).max(10), minLevel: z.number().int().min(0).optional() }),
]);

export type Question = z.infer<typeof questionSchema>;
export type QuestionKind = Question["kind"];

export type Answer =
  | { kind: "noul"; probability: number }
  | { kind: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
  | { kind: "score"; score: number; label: string; confidence: number; probabilities: number[] };

const yes = (id: string, section: SectionKey, text: string): Question => ({ id, section, kind: "noul", text, expected: true });

export const DEFAULT_QUESTIONS: Question[] = [
  yes("file-ulad", "file", "This is a MISMO 3.4 residential loan application (URLA / Form 1003 data)."),
  yes("file-one-loan", "file", "The file contains exactly one subject loan."),
  yes("file-has-borrower", "file", "The file contains at least one party with the Borrower role."),

  yes("bor-names", "borrowers", "Every borrower has both a first name and a last name."),
  yes("bor-dob", "borrowers", "Every borrower has a birth date."),
  yes("bor-ssn", "borrowers", "Every borrower has a taxpayer identifier (SSN), shown masked."),
  yes("bor-marital", "borrowers", "Every borrower has a marital status."),
  yes("bor-residence", "borrowers", "Every borrower has a current residence with a street address, city, state and postal code."),
  yes("bor-state", "borrowers", "Every borrower residence state is a valid two-letter US state code."),
  yes("bor-zip", "borrowers", "Every borrower residence postal code is a valid 5-digit or ZIP+4 code."),
  yes("bor-primary", "borrowers", "Exactly one borrower is classified as the primary borrower."),
  yes("bor-contact", "borrowers", "The primary borrower has an email address or a phone number."),

  yes("inc-employer-name", "income", "Every employer has a name."),
  yes("inc-start-date", "income", "Every current employment has a start date."),
  yes("inc-start-past", "income", "No employment start date is later than today's date."),
  yes("inc-amount", "income", "Every income item has a monthly amount greater than zero."),
  yes("inc-type", "income", "Every income item has an income type."),
  yes("inc-linked", "income", "Every employment income item is linked to an employer."),
  yes("inc-each-borrower", "income", "Every borrower has at least one income item."),

  yes("ast-type", "assets", "Every asset has an asset type or is an owned property."),
  yes("ast-value", "assets", "Every financial account asset has a cash or market value that is zero or more."),
  yes("ast-holder", "assets", "Every financial account asset names the institution that holds it."),
  yes("ast-linked", "assets", "Every asset is linked to at least one borrower."),
  yes("ast-reo-address", "assets", "Every owned property has a complete address and an estimated value."),

  yes("lia-type", "liabilities", "Every liability has a liability type."),
  yes("lia-creditor", "liabilities", "Every liability names its creditor."),
  yes("lia-balance", "liabilities", "Every liability has an unpaid balance."),
  yes("lia-payment", "liabilities", "Every liability has a monthly payment amount."),
  yes("lia-linked", "liabilities", "Every liability is linked to at least one borrower."),
  yes("lia-mortgage-reo", "liabilities", "Every mortgage liability is linked to an owned property."),

  yes("dec-present", "declarations", "Every borrower has a declarations section."),
  yes("dec-complete", "declarations", "For every borrower that has declarations, the bankruptcy, foreclosure, outstanding judgments, lawsuit and delinquent federal debt questions are all answered."),
  yes("dec-occupancy", "declarations", "The borrowers' intent to occupy the property is consistent with the subject property usage type."),

  yes("prop-address", "property", "The subject property has a street address, city, state and postal code."),
  yes("prop-value", "property", "The subject property has an estimated value or a sales contract amount."),
  { id: "loan-purpose", section: "property", kind: "choice", text: "What is the purpose of the loan?", options: ["Purchase", "Refinance", "Other", "Not stated"] },
  yes("loan-amount", "property", "The loan has a note amount or base loan amount greater than zero."),
  yes("loan-ltv", "property", "The loan amount is not greater than the subject property value."),
  yes("loan-contract", "property", "If the loan purpose is Purchase, the file has a sales contract amount."),
  yes("loan-type", "property", "The loan has a mortgage type and an amortization term."),
];

/** The request body of POST /api/evaluate. */
export const evaluateRequestSchema = z.object({
  xml: z.string().min(1),
  questions: z.array(questionSchema).min(1).max(60),
});

export interface EvaluateResponse {
  model: string;
  answers: Record<string, Answer>;
  /** Tokens Jev billed for this request, or null when the API did not report them. */
  inputTokens: number | null;
}
