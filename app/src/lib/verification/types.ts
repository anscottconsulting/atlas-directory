/**
 * Shared types for the Verification tab.
 *
 * Status model follows the three-level scoring framework:
 *   verified  - strong identity evidence, supporting checks consistent
 *   partial   - likely match with conflicting or incomplete evidence
 *   unable    - no supported candidate or unresolved ambiguity
 */

export type MatchStatus = "verified" | "partial" | "unable";
export type Confidence = "High" | "Medium" | "Low" | "None";
export type EntryType = "Organization" | "Practitioner";

export type ReasonKey =
  | "npi-billing"
  | "address"
  | "activity"
  | "entry-type"
  | "name-variant"
  | "covered-entity"
  | "oid"
  | "registration"
  | "no-candidate"
  | "ambiguous";

export interface QueueEntry {
  id: string;
  org: string;
  npi?: string;
  candidate: string;
  candidateNpi?: string;
  confidence: Confidence;
  status: MatchStatus;
  reasonKey: ReasonKey;
  reason: string;
  submitter: string;
  owner?: string;
  ageDays: number;
  entryType: EntryType;
}

/** evidence: nothing wrong, but it can only be confirmed with a document from the submitter. */
export type CheckResult = "pass" | "question" | "fail" | "evidence" | "not-run";

export interface SupportingCheck {
  name: string;
  result: CheckResult;
  detail: string;
  source: string;
}

export interface Candidate {
  name: string;
  npi: string;
  kind: string;
  nameMatch: string;
  addressMatch: string;
  activity: string;
  score: number;
  confidence: Confidence;
  disposition: "selected" | "kept" | "rejected";
}

export interface MatchPass {
  pass: number;
  description: string;
  outcome: "continued" | "match" | "unresolved";
}

export interface EntryDetail {
  id: string;
  headline: string;
  explanation: string;
  submitted: {
    name: string;
    npi: string;
    address: string[];
    oid: string;
    endpoint: string;
    managingOrg: string;
  };
  delegates: number;
  candidates: Candidate[];
  passes: MatchPass[];
  checks: SupportingCheck[];
  suggestedQuestion: string;
  history: { at: string; text: string }[];
}

export type IssueStep = "review" | "clarification" | "recheck" | "closed" | "policy";

export interface IssueMessage {
  from: "verifier" | "submitter";
  author: string;
  at: string;
  body: string;
  attachment?: string;
}

export interface Issue {
  id: string;
  entryId: string;
  title: string;
  org: string;
  submitter: string;
  step: IssueStep;
  owner: string;
  due: string;
  nextAction: string;
  messages: IssueMessage[];
  correction: { field: string; current: string; after: string; changed: boolean }[];
  policyQuestion?: { text: string; similarOpen: number };
}
