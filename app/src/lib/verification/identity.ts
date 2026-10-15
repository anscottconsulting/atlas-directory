/**
 * Level 2: intelligent validation.
 *
 * Runs on entries that pass Level 1. Checks the NPI against the NPPES NPI
 * Registry (exists, active, organization, name and state match), checks the
 * EIN's format, and applies the directory rules from ./rules.
 *
 * There's no public API for confirming an EIN belongs to an organization, so
 * a well-formed EIN is marked "evidence": confirmed by an IRS letter from the
 * submitter (CP 575 or 147C) through the evidence-request flow.
 */

import type { CheckResult, MatchStatus } from "./types";
import { isValidNpi, npiOf, type OrgResult } from "./rules";

export const EIN_SYSTEM = "urn:oid:2.16.840.1.113883.4.4";

// Two-digit EIN prefixes the IRS has never assigned.
const UNASSIGNED_EIN_PREFIXES = new Set(["00", "07", "08", "09", "17", "18", "19", "28", "29", "49", "69", "70", "78", "79", "89", "96", "97"]);

export function einOf(org: fhir4.Organization): string | undefined {
  return org.identifier?.find((i) => i.system === EIN_SYSTEM)?.value;
}

/** Null when the EIN is well formed, otherwise what's wrong with it. */
export function einFormatProblem(ein: string): string | null {
  if (!/^\d{2}-?\d{7}$/.test(ein.trim())) return "EIN must be 9 digits, written NN-NNNNNNN";
  const prefix = ein.trim().slice(0, 2);
  if (UNASSIGNED_EIN_PREFIXES.has(prefix)) return `EIN prefix ${prefix} has never been assigned by the IRS`;
  return null;
}

interface NppesAddress {
  address_purpose: "LOCATION" | "MAILING";
  city: string;
  state: string;
}

export interface NppesRecord {
  number: string;
  enumeration_type: "NPI-1" | "NPI-2";
  basic: { status?: string; organization_name?: string; first_name?: string; last_name?: string };
  addresses: NppesAddress[];
  other_names?: { organization_name?: string }[];
}

/** Look up an NPI in the NPPES registry (through the /nppes proxy). Null when not found. */
export async function lookupNpi(npi: string): Promise<NppesRecord | null> {
  const res = await fetch(`/nppes/api/?version=2.1&number=${encodeURIComponent(npi)}`);
  if (!res.ok) throw new Error(`NPPES lookup failed (HTTP ${res.status})`);
  const body = await res.json();
  if (body.Errors?.length) throw new Error(`NPPES: ${body.Errors[0].description}`);
  return body.results?.[0] ?? null;
}

export interface IdentityCheck {
  name: string;
  result: CheckResult;
  detail: string;
}

export interface IdentityResult {
  checks: IdentityCheck[];
  status: MatchStatus;
  /** Something can only be confirmed with a document from the submitter. */
  evidenceNeeded: boolean;
}

const STOPWORDS = new Set(["inc", "llc", "pllc", "pc", "pa", "corp", "co", "ltd", "the", "of", "and"]);

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t && !STOPWORDS.has(t)),
  );
}

/** Share of words in common, ignoring legal suffixes like LLC. */
function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.size || !tb.size) return 0;
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return shared / new Set([...ta, ...tb]).size;
}

/**
 * Identity checks for one organization. `rules` is the entry's result from
 * the directory rules; each failing rule becomes a question.
 */
export async function verifyIdentity(org: fhir4.Organization, rules: OrgResult): Promise<IdentityResult> {
  const checks: IdentityCheck[] = [];
  const npi = npiOf(org);

  if (!npi) {
    checks.push({ name: "NPI", result: "question", detail: "No NPI on file, so identity can't be checked against NPPES" });
  } else if (!isValidNpi(npi)) {
    checks.push({ name: "NPI", result: "fail", detail: `${npi} fails the NPI check digit` });
  } else {
    const rec = await lookupNpi(npi);
    if (!rec) {
      checks.push({ name: "NPI", result: "fail", detail: `${npi} isn't in the NPPES registry` });
    } else if (rec.basic.status && rec.basic.status !== "A") {
      checks.push({ name: "NPI", result: "fail", detail: `${npi} is deactivated in NPPES` });
    } else if (rec.enumeration_type === "NPI-1") {
      const person = [rec.basic.first_name, rec.basic.last_name].filter(Boolean).join(" ");
      checks.push({ name: "NPI", result: "question", detail: `${npi} belongs to an individual (${person}), not an organization` });
    } else {
      checks.push({ name: "NPI", result: "pass", detail: `${npi} is an active organization NPI` });

      const names = [rec.basic.organization_name, ...(rec.other_names ?? []).map((n) => n.organization_name)].filter(Boolean) as string[];
      const best = Math.max(...names.map((n) => nameSimilarity(org.name ?? "", n)));
      checks.push(
        best >= 0.6
          ? { name: "Name", result: "pass", detail: `Matches NPPES name "${rec.basic.organization_name}"` }
          : { name: "Name", result: "question", detail: `NPPES has "${rec.basic.organization_name}"` },
      );

      const state = org.address?.[0]?.state;
      const location = rec.addresses.find((a) => a.address_purpose === "LOCATION");
      if (!state || !location) {
        checks.push({ name: "State", result: "not-run", detail: "No state to compare" });
      } else if (state.toUpperCase() === location.state.toUpperCase()) {
        checks.push({ name: "State", result: "pass", detail: `Practice location is in ${location.state}` });
      } else {
        checks.push({ name: "State", result: "question", detail: `NPPES practice location is ${location.city}, ${location.state}` });
      }
    }
  }

  const ein = einOf(org);
  const einProblem = ein ? einFormatProblem(ein) : null;
  if (!ein) {
    checks.push({ name: "EIN", result: "question", detail: "No EIN on file" });
  } else if (einProblem) {
    checks.push({ name: "EIN", result: "question", detail: einProblem });
  } else {
    checks.push({ name: "EIN", result: "evidence", detail: `${ein} is well formed; confirm with an IRS letter (CP 575 or 147C)` });
  }

  for (const f of rules.failures) {
    checks.push({ name: f.rule.field, result: "question", detail: f.message });
  }

  const status: MatchStatus = checks.some((c) => c.result === "fail")
    ? "unable"
    : checks.some((c) => c.result === "question")
      ? "partial"
      : "verified";
  return { checks, status, evidenceNeeded: checks.some((c) => c.result === "evidence") };
}

/** Run verifyIdentity over many orgs, a few NPPES calls at a time. */
export async function verifyAll(
  items: { org: fhir4.Organization; rules: OrgResult }[],
  concurrency = 3,
): Promise<Map<string, IdentityResult>> {
  const out = new Map<string, IdentityResult>();
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const { org, rules } = items[next++];
      out.set(org.id!, await verifyIdentity(org, rules));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}
