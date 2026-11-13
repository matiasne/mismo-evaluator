import { XMLParser, XMLValidator } from "fast-xml-parser";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

export interface MismoSummary {
  version: string | null;
  borrowers: string[];
  loanPurpose: string | null;
  mortgageType: string | null;
  noteAmount: string | null;
  counts: {
    employers: number;
    incomeItems: number;
    assets: number;
    liabilities: number;
    ownedProperties: number;
    declarations: number;
  };
}

export type ParseResult =
  | { ok: true; state: Json; summary: MismoSummary; approxTokens: number }
  | { ok: false; error: string };

export const MAX_XML_BYTES = 4 * 1024 * 1024;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  // Keep every value as text: ZIP codes and account numbers must not lose leading zeros.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

const isObject = (v: Json | undefined): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const DROPPED_ATTRIBUTES = /^@(xmlns|schemaLocation)/;

function maskTaxpayerId(value: Json): Json {
  const digits = String(value).replace(/\D/g, "");
  return digits.length >= 4 ? `***-**-${digits.slice(-4)}` : "***";
}

/** Drops empty nodes and namespace declarations, and masks SSNs, so the state is small and safe to send. */
function compact(node: Json, key?: string): Json | undefined {
  if (key === "TaxpayerIdentifierValue" && node !== "") return maskTaxpayerId(node);
  if (Array.isArray(node)) {
    const items = node.map((item) => compact(item)).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (isObject(node)) {
    const out: JsonObject = {};
    for (const [k, v] of Object.entries(node)) {
      if (DROPPED_ATTRIBUTES.test(k) || k.startsWith("?")) continue;
      const kept = compact(v, k);
      if (kept !== undefined) out[k] = kept;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return node === "" || node === null ? undefined : node;
}

/** Every node stored under `key`, at any depth. */
function findAll(node: Json | undefined, key: string, found: Json[] = []): Json[] {
  if (Array.isArray(node)) {
    for (const item of node) findAll(item, key, found);
  } else if (isObject(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k === key) found.push(...(Array.isArray(v) ? v : [v]));
      else findAll(v, key, found);
    }
  }
  return found;
}

const firstText = (node: Json | undefined, key: string): string | null => {
  const hit = findAll(node, key).find((v) => typeof v === "string");
  return typeof hit === "string" ? hit : null;
};

function summarize(message: JsonObject): MismoSummary {
  const borrowerParties = findAll(message, "PARTY").filter((party) => findAll(party, "BORROWER").length > 0);
  const assets = findAll(message, "ASSET");
  const ownedProperties = assets.filter((asset) => findAll(asset, "OWNED_PROPERTY").length > 0);
  const loans = findAll(message, "LOAN");
  const subjectLoan = loans.find((loan) => isObject(loan) && loan["@LoanRoleType"] === "SubjectLoan") ?? loans[0];
  const version = message["@MISMOReferenceModelIdentifier"];

  return {
    version: typeof version === "string" ? version : null,
    borrowers: borrowerParties.map((party) => {
      const name = [firstText(party, "FirstName"), firstText(party, "LastName")].filter(Boolean).join(" ");
      return name || "(no name)";
    }),
    loanPurpose: firstText(subjectLoan, "LoanPurposeType"),
    mortgageType: firstText(subjectLoan, "MortgageType"),
    noteAmount: firstText(subjectLoan, "NoteAmount") ?? firstText(subjectLoan, "BaseLoanAmount"),
    counts: {
      employers: findAll(message, "EMPLOYER").length,
      incomeItems: findAll(message, "CURRENT_INCOME_ITEM").length,
      assets: assets.length - ownedProperties.length,
      liabilities: findAll(message, "LIABILITY").length,
      ownedProperties: ownedProperties.length,
      declarations: findAll(message, "DECLARATION_DETAIL").length,
    },
  };
}

/** Parses a MISMO XML file into the compact JSON state Jev evaluates, plus a summary for the UI. */
export function parseMismo(xml: string): ParseResult {
  if (!xml.trim()) return { ok: false, error: "The file is empty." };

  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    const { msg, line } = validation.err;
    return { ok: false, error: `This is not well-formed XML (line ${line}: ${msg}).` };
  }

  const document = parser.parse(xml) as JsonObject;
  const message = document.MESSAGE;
  if (!isObject(message)) {
    return { ok: false, error: "This XML is not a MISMO file: the root element must be MESSAGE." };
  }
  if (findAll(message, "DEAL").length === 0) {
    return { ok: false, error: "This MISMO file has no DEAL, so there is no loan application to evaluate." };
  }

  const state = compact(message) ?? {};
  return {
    ok: true,
    state,
    summary: summarize(message),
    approxTokens: Math.ceil(JSON.stringify(state).length / 3),
  };
}
