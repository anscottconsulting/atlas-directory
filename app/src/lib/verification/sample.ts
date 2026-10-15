/**
 * SAMPLE verification run.
 *
 * Identity matching needs external sources (NPPES, state registries, claims
 * activity) that the sandbox doesn't have, so the Overview, Queue, Entry,
 * Issue and Submitter screens read from this file. Swap these exports for a
 * real service when one exists; the page components only depend on the
 * shapes in ./types.
 *
 * Run size and the status split come from a matching pilot result
 * (83.6 / 15.9 / 0.5). Every name, NPI and per-submitter count is invented.
 *
 * Level 1 (IG conformance) runs first on everything submitted; only entries
 * that pass go to Level 2 (identity matching), so RUN.total is the Level 1
 * pass count. The Level 1 rates (about 85% pass first time) and failure
 * reasons are assumptions, not pilot data.
 */

import type { EntryDetail, Issue, QueueEntry, ReasonKey } from "./types";

export const RUN = {
  label: "New entries · sample run",
  // Level 1: submitted = passed (total) + failing.
  submitted: 2576,
  level1Failing: 391,
  // Entries with at least one Must Support element empty. Warnings only.
  mustSupportGaps: 2431,
  // Level 2, on the 2,185 entries that passed Level 1.
  total: 2185,
  verified: 1826,
  partial: 348,
  unable: 11,
  clarificationsOpen: 207,
  evidenceRequests: 314,
};

// Main reason each Level 1 failure fails. Sums to RUN.level1Failing.
export const LEVEL1_REASONS: { label: string; count: number }[] = [
  { label: "Required extensions missing (Domains, UseCases, managing org)", count: 128 },
  { label: "HCID identifier missing or malformed", count: 104 },
  { label: "US address incomplete (city, state or postal code)", count: 71 },
  { label: "Organization type missing or not an RCE type", count: 46 },
  { label: "Child entry has an endpoint", count: 23 },
  { label: "Endpoint missing transaction or managing organization", count: 19 },
];

export const PARTIAL_REASONS: { key: ReasonKey; label: string; count: number }[] = [
  { key: "npi-billing", label: "Supplied NPI differs from billing NPI", count: 142 },
  { key: "address", label: "Address does not match candidate", count: 88 },
  { key: "activity", label: "No recent claims activity found", count: 61 },
  { key: "entry-type", label: "Entry type conflicts with NPI type", count: 37 },
  { key: "name-variant", label: "Name matches only as a variant or DBA", count: 20 },
];

export const STAGES = [
  { name: "Level 1 conformance", detail: "Validated against the RCE IG profiles; failures go back to the submitter", state: "2,576 checked · 391 failing" },
  { name: "Identity matching", detail: "Candidates retrieved, ranked and scored across passes", state: "2,185 done" },
  { name: "Supporting checks", detail: "Address, activity, entry type, OID, certificate", state: "2,185 done" },
  { name: "Covered-entity validation", detail: "Claims-volume threshold against claims data", state: "1,512 passed · 314 short" },
  { name: "Submitter follow-up", detail: "Clarifications and evidence requests", state: "521 open" },
  { name: "Determination and notice", detail: "Result written to directory flag and sent to submitter", state: "1,512 sent" },
];

// submitted = total (passed Level 1) + level1Failing. Clarifications go to
// partial or unable entries; evidence requests go to verified entries whose
// covered-entity check came up short. Columns sum to RUN.
export const SUBMITTERS = [
  { name: "Clearpath Health Network", submitted: 701, level1Failing: 89, total: 612, verified: 541, partial: 68, unable: 3, clarifications: 41, evidence: 88, oldest: "9 days" },
  { name: "Northgate HIE Services", submitted: 574, level1Failing: 86, total: 488, verified: 409, partial: 77, unable: 2, clarifications: 52, evidence: 70, oldest: "14 days" },
  { name: "Bluestem Clinical Systems", submitted: 497, level1Failing: 66, total: 431, verified: 362, partial: 66, unable: 3, clarifications: 38, evidence: 62, oldest: "6 days" },
  { name: "Meridian Exchange Partners", submitted: 452, level1Failing: 75, total: 377, verified: 312, partial: 63, unable: 2, clarifications: 29, evidence: 54, oldest: "11 days" },
  { name: "Lakeshore Interop Group", submitted: 352, level1Failing: 75, total: 277, verified: 202, partial: 74, unable: 1, clarifications: 47, evidence: 40, oldest: "21 days" },
];


export const QUEUE: QueueEntry[] = [
  { id: "VR-0004187", org: "Riverbend Family Medicine", npi: "1295837461", candidate: "Riverbend Health Partners PLLC", candidateNpi: "1730582914", confidence: "High", status: "partial", reasonKey: "npi-billing", reason: "Supplied NPI differs from billing NPI at same address", submitter: "Northgate HIE Services", ageDays: 3, entryType: "Organization" },
  { id: "VR-0004203", org: "Oak Hollow Pediatrics", npi: "1588204736", candidate: "Oak Hollow Pediatrics PC", candidateNpi: "1588204736", confidence: "High", status: "partial", reasonKey: "activity", reason: "No claims activity in last 12 months", submitter: "Clearpath Health Network", owner: "J. Alvarez", ageDays: 3, entryType: "Organization" },
  { id: "VR-0004211", org: "Summit Ridge Imaging", npi: "1063947285", candidate: "Summit Ridge Imaging LLC", candidateNpi: "1063947285", confidence: "Medium", status: "partial", reasonKey: "address", reason: "Address on entry is a billing office, not a service site", submitter: "Lakeshore Interop Group", ageDays: 4, entryType: "Organization" },
  { id: "VR-0004226", org: "Dr. Ellen Varga", npi: "1427583910", candidate: "Varga Dermatology Associates", candidateNpi: "1912046358", confidence: "Medium", status: "partial", reasonKey: "entry-type", reason: "Listed as organization, NPI is Type 1 (individual)", submitter: "Bluestem Clinical Systems", owner: "K. Osei", ageDays: 4, entryType: "Practitioner" },
  { id: "VR-0004240", org: "Harbor Point Recovery Services", candidate: "No supported candidate", confidence: "None", status: "unable", reasonKey: "no-candidate", reason: "No candidate after 3 passes. Not in NPPES or state registry under listed name", submitter: "Lakeshore Interop Group", ageDays: 5, entryType: "Organization" },
  { id: "VR-0004252", org: "Fairmont Ortho Specialists", npi: "1356094827", candidate: "Fairmont Orthopaedic Specialists PA", candidateNpi: "1356094827", confidence: "High", status: "partial", reasonKey: "name-variant", reason: "Name matches only as a variant spelling", submitter: "Meridian Exchange Partners", owner: "J. Alvarez", ageDays: 5, entryType: "Organization" },
  { id: "VR-0004266", org: "Westlake Urgent Care North", npi: "1740395628", candidate: "Westlake Urgent Care Inc", candidateNpi: "1740395628", confidence: "Medium", status: "partial", reasonKey: "address", reason: "Address mismatch: suite and ZIP differ", submitter: "Clearpath Health Network", ageDays: 6, entryType: "Organization" },
  { id: "VR-0004271", org: "Prairie View Health", npi: "1871036452", candidate: "2 candidates, tied", confidence: "Low", status: "unable", reasonKey: "ambiguous", reason: "Ambiguous: two active orgs share the name in different states", submitter: "Northgate HIE Services", owner: "K. Osei", ageDays: 6, entryType: "Organization" },
  { id: "VR-0004289", org: "Cedar Lane Behavioral", npi: "1609482735", candidate: "Cedar Lane Counseling LLC", candidateNpi: "1609482735", confidence: "Medium", status: "partial", reasonKey: "covered-entity", reason: "Taxonomy suggests non-covered entity. Evidence needed", submitter: "Bluestem Clinical Systems", ageDays: 7, entryType: "Organization" },
  { id: "VR-0004295", org: "Bayside Senior Living", npi: "1497206384", candidate: "Bayside Senior Living Corp", candidateNpi: "1497206384", confidence: "High", status: "partial", reasonKey: "covered-entity", reason: "Below claims-volume threshold for covered-entity check", submitter: "Meridian Exchange Partners", ageDays: 8, entryType: "Organization" },
  { id: "VR-0004302", org: "Mill Creek Labs", npi: "1235908476", candidate: "Mill Creek Laboratory Services", candidateNpi: "1235908476", confidence: "High", status: "partial", reasonKey: "oid", reason: "Endpoint OID not found in registry", submitter: "Clearpath Health Network", owner: "J. Alvarez", ageDays: 9, entryType: "Organization" },
  { id: "VR-0004318", org: "Valley Health Collaborative", npi: "1964310587", candidate: "Valley Health Collaborative Inc", candidateNpi: "1964310587", confidence: "Medium", status: "partial", reasonKey: "registration", reason: "State registration shows inactive status", submitter: "Lakeshore Interop Group", ageDays: 11, entryType: "Organization" },
];

export const ENTRY_DETAILS: Record<string, EntryDetail> = {
  "VR-0004187": {
    id: "VR-0004187",
    headline: "The supplied NPI is real, it just isn't the one doing the billing",
    explanation:
      "NPI 1295837461 matches the name and address but shows no claims activity in the last 12 months. Riverbend Health Partners PLLC, at the same suite, bills under 1730582914 and passes the covered-entity threshold. Both identifiers stay on the record so the next reviewer sees the relationship.",
    submitted: {
      name: "Riverbend Family Medicine",
      npi: "1295837461",
      address: ["410 Mill Street, Suite 200", "Franklin, TN 37064"],
      oid: "2.16.840.1.113883.3.9921.4.187",
      endpoint: "https://xca.northgate-hie.example/riverbend",
      managingOrg: "Northgate HIE Services",
    },
    delegates: 4,
    candidates: [
      { name: "Riverbend Health Partners PLLC", npi: "1730582914", kind: "Type 2 · Family medicine group", nameMatch: "Related name", addressMatch: "Exact, same suite", activity: "Yes, above threshold", score: 91, confidence: "High", disposition: "selected" },
      { name: "Riverbend Family Medicine", npi: "1295837461", kind: "Type 2 · as supplied", nameMatch: "Exact", addressMatch: "Exact, same suite", activity: "None in 12 months", score: 74, confidence: "Medium", disposition: "kept" },
      { name: "Riverbend Family Dental", npi: "1846029371", kind: "Type 2 · Dentistry", nameMatch: "Partial", addressMatch: "Same city only", activity: "Yes", score: 38, confidence: "Low", disposition: "rejected" },
    ],
    passes: [
      { pass: 1, description: "Exact NPI lookup. Found the supplied NPI, but no billing activity, so evidence was insufficient.", outcome: "continued" },
      { pass: 2, description: "Name plus normalized address. Three candidates retrieved and ranked.", outcome: "continued" },
      { pass: 3, description: "Same-address expansion for billing entities. Selected Riverbend Health Partners PLLC.", outcome: "match" },
    ],
    checks: [
      { name: "Legal entity active", result: "pass", detail: "Riverbend Health Partners PLLC active, good standing", source: "State registry" },
      { name: "Address", result: "pass", detail: "USPS-normalized address matches selected candidate", source: "NPPES" },
      { name: "Activity", result: "question", detail: "Activity found for billing entity only, none for supplied NPI", source: "Claims data" },
      { name: "Entry type", result: "pass", detail: "Organization entry, Type 2 NPI on both candidates", source: "NPPES" },
      { name: "Covered entity", result: "question", detail: "Billing entity meets claims threshold. Policy call: does that carry to the listed org?", source: "Claims data" },
      { name: "Home community OID", result: "pass", detail: "Registered, assigning authority matches submitter", source: "OID registry" },
      { name: "Endpoint certificate", result: "not-run", detail: "Queued until identity questions close", source: "Trust bundle" },
    ],
    suggestedQuestion:
      "Riverbend Family Medicine is listed with NPI 1295837461, but billing at 410 Mill Street Suite 200 runs under Riverbend Health Partners PLLC (1730582914). Is the listed organization part of that group? If so, please confirm which NPI should appear on the entry.",
    history: [
      { at: "[date] 09:14", text: "Run started, entry ingested from directory" },
      { at: "[date] 09:16", text: "Matching finished after 3 passes" },
      { at: "[date] 09:21", text: "Supporting checks finished, status set to Partially verified" },
      { at: "[date] 10:02", text: "Opened by verification analyst" },
    ],
  },
};

export const ISSUES: Issue[] = [
  {
    id: "ISS-0219",
    entryId: "VR-0004187",
    title: "Which NPI belongs on the Riverbend entry?",
    org: "Riverbend Family Medicine",
    submitter: "Northgate HIE Services",
    step: "recheck",
    owner: "J. Alvarez",
    due: "[date] · 11 business days left",
    nextAction: "Rerun matching with parent NPI, then decide",
    messages: [
      { from: "verifier", author: "Validation team", at: "[date]", body: ENTRY_DETAILS["VR-0004187"].suggestedQuestion },
      {
        from: "submitter",
        author: "Northgate HIE Services",
        at: "[date]",
        body: "Yes. Riverbend Family Medicine is one clinic location of Riverbend Health Partners. The location NPI is what their EHR sends, so we'd like to keep it, but we can add the group NPI as the parent. Ownership letter attached.",
        attachment: "Riverbend ownership letter.pdf",
      },
    ],
    correction: [
      { field: "Supplied NPI", current: "1295837461", after: "1295837461 (unchanged)", changed: false },
      { field: "Parent organization", current: "(blank)", after: "Riverbend Health Partners PLLC · 1730582914", changed: true },
      { field: "Evidence on file", current: "(none)", after: "Ownership letter, received [date]", changed: true },
      { field: "Status", current: "Partially verified", after: "Pending rerun", changed: false },
    ],
    policyQuestion: {
      text: "Does the parent group's covered-entity result carry to a location entry that bills under the parent? Until there's a rule, these go to policy review instead of being closed by an analyst.",
      similarOpen: 23,
    },
  },
  {
    id: "ISS-0224",
    entryId: "VR-0004271",
    title: "Two organizations share the name Prairie View Health",
    org: "Prairie View Health",
    submitter: "Northgate HIE Services",
    step: "clarification",
    owner: "K. Osei",
    due: "[date] · 6 business days left",
    nextAction: "Waiting on submitter to pick the right organization",
    messages: [
      { from: "verifier", author: "Validation team", at: "[date]", body: "Two active organizations named Prairie View Health match this entry, one in Kansas and one in Nebraska. Which one is yours? A state registration number would settle it." },
    ],
    correction: [],
  },
  {
    id: "ISS-0231",
    entryId: "VR-0004240",
    title: "No supported candidate for Harbor Point Recovery Services",
    org: "Harbor Point Recovery Services",
    submitter: "Lakeshore Interop Group",
    step: "review",
    owner: "Unassigned",
    due: "[date] · 14 business days left",
    nextAction: "Manual review: record the reason before contacting submitter",
    messages: [],
    correction: [],
  },
];

