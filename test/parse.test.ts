import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMismo } from "../lib/mismo/parse";

const sample = readFileSync(new URL("../public/samples/sample-urla.xml", import.meta.url), "utf8");

describe("parseMismo", () => {
  it("summarizes the sample file", () => {
    const parsed = parseMismo(sample);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.summary).toEqual({
      version: "3.4.032420160128",
      borrowers: ["Robin Patel", "Sam Patel"],
      loanPurpose: "Purchase",
      mortgageType: "Conventional",
      noteAmount: "352000.00",
      counts: { employers: 2, incomeItems: 3, assets: 3, liabilities: 3, ownedProperties: 1, declarations: 1 },
    });
  });

  it("masks SSNs and never sends the full number", () => {
    const parsed = parseMismo(sample);
    if (!parsed.ok) throw new Error(parsed.error);
    const sent = JSON.stringify(parsed.state);
    expect(sent).toContain("***-**-4321");
    expect(sent).toContain("***-**-8765");
    expect(sent).not.toContain("900114321");
    expect(sent).not.toContain("900-22-8765");
  });

  it("strips namespaces and empty nodes but keeps relationships and text values", () => {
    const parsed = parseMismo(sample);
    if (!parsed.ok) throw new Error(parsed.error);
    const sent = JSON.stringify(parsed.state);
    expect(sent).not.toContain("xmlns");
    expect(sent).not.toContain("xlink:");
    expect(sent).toContain('"@from":"ASSET_1"');
    expect(sent).toContain('"@label":"BORROWER_2"');
    expect(sent).toContain('"PostalCode":"48220"');
    // The co-borrower's employer has an empty name: the empty node is dropped.
    expect(sent).not.toContain('"FullName":""');
  });

  it("keeps leading zeros", () => {
    const parsed = parseMismo("<MESSAGE><DEAL><PostalCode>02134</PostalCode></DEAL></MESSAGE>");
    if (!parsed.ok) throw new Error(parsed.error);
    expect(JSON.stringify(parsed.state)).toContain('"02134"');
  });

  it("accepts a MESSAGE wrapped in an envelope, such as a Freddie Mac LPA request", () => {
    const parsed = parseMismo(
      `<lparqst:LPALoanAssessmentServiceRequest xmlns="http://www.mismo.org/residential/2009/schemas" xmlns:lparqst="http://www.freddiemac.com/lpa/LPALoanAssessmentService/schemas">
        <MESSAGE MISMOReferenceModelIdentifier="3.4.032420160128"><DEAL_SETS><DEAL_SET><DEALS><DEAL>
          <LOANS><LOAN LoanRoleType="SubjectLoan"><TERMS_OF_LOAN><BaseLoanAmount>100000</BaseLoanAmount><LoanPurposeType>Purchase</LoanPurposeType></TERMS_OF_LOAN></LOAN></LOANS>
          <PARTIES><PARTY><INDIVIDUAL><NAME><FirstName>Alice</FirstName><LastName>Firstimer</LastName></NAME></INDIVIDUAL><ROLES><ROLE><BORROWER/></ROLE></ROLES></PARTY></PARTIES>
        </DEAL></DEALS></DEAL_SET></DEAL_SETS></MESSAGE>
      </lparqst:LPALoanAssessmentServiceRequest>`,
    );
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.summary).toMatchObject({ version: "3.4.032420160128", borrowers: ["Alice Firstimer"], loanPurpose: "Purchase", noteAmount: "100000" });
    expect(JSON.stringify(parsed.state)).not.toContain("LPALoanAssessmentServiceRequest");
  });

  it("rejects files that are not MISMO loan applications", () => {
    expect(parseMismo("")).toMatchObject({ ok: false });
    expect(parseMismo("<MESSAGE><DEAL></MESSAGE>")).toMatchObject({ ok: false, error: expect.stringContaining("well-formed") });
    expect(parseMismo("<html><body/></html>")).toMatchObject({ ok: false, error: expect.stringContaining("MESSAGE") });
    expect(parseMismo("<MESSAGE><ABOUT_VERSIONS/></MESSAGE>")).toMatchObject({ ok: false, error: expect.stringContaining("DEAL") });
    expect(parseMismo("just some text")).toMatchObject({ ok: false });
  });
});
