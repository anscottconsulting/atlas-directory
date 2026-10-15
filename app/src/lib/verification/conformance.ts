/**
 * Level 1: base conformance.
 *
 * Validates an Organization against its RCE role profile with the server's
 * $validate, which checks cardinality, required slices, fixed values and the
 * profile's invariants. Errors block Level 2.
 *
 * It then lists Must Support elements that aren't populated. The validator
 * never flags those, because Must Support means "must be able to handle when
 * present", not "required". They're warnings and don't block Level 2.
 *
 * The TEFCA ID is assigned by Sequoia when an entry is created, so a
 * submitter can't supply it. An entry without one is validated with a
 * placeholder TEFCA ID and gets a notice instead of an error.
 */

import { fhir } from "../fhir-client";
import { PROFILE, roleOf } from "../rce-profiles";

export interface ConformanceIssue {
  source: "profile" | "must-support";
  path: string;
  message: string;
}

export interface ConformanceResult {
  profile?: string;
  errors: ConformanceIssue[];
  warnings: ConformanceIssue[];
  /** Information that isn't a problem with the entry. */
  notices: string[];
  passes: boolean;
}

const IDENTIFIER_CODES = "https://sequoiaproject.org/fhir/sphd/CodeSystem/SequoiaIdentifierCodes";

/** The TEFCAID identifier slice from the RCE profiles, with a placeholder value. */
const PLACEHOLDER_TEFCA_ID: fhir4.Identifier = {
  type: { coding: [{ system: IDENTIFIER_CODES, code: "TEFCAID" }] },
  system: "urn:ietf:rfc:3986",
  value: "urn:oid:2.16.840.1.113883.3.7204.1.5.0",
};

function hasTefcaId(org: fhir4.Organization): boolean {
  return (org.identifier ?? []).some((i) => i.type?.coding?.some((c) => c.system === IDENTIFIER_CODES && c.code === "TEFCAID"));
}

// Validator warnings that come from how we call it, not from the entry:
// narrative is stripped before validating (the IG's own narrative links
// break validation), and the server doesn't load US Core terminology.
const IGNORED_WARNINGS = [/dom-6/, /ValueSet '[^']+' not found/];

const profileCache = new Map<string, Promise<fhir4.StructureDefinition | undefined>>();

function loadProfile(url: string) {
  let p = profileCache.get(url);
  if (!p) {
    p = fhir
      .search<fhir4.StructureDefinition>("StructureDefinition", { url })
      .then((b) => b.entry?.[0]?.resource);
    profileCache.set(url, p);
  }
  return p;
}

export async function checkConformance(org: fhir4.Organization): Promise<ConformanceResult> {
  const role = roleOf(org);
  if (role === "Unknown") {
    const error = { source: "profile" as const, path: "Organization.meta.profile", message: "No RCE role profile, so there's nothing to validate against" };
    return { errors: [error], warnings: [], notices: [], passes: false };
  }
  const profile = PROFILE[role];
  const { text: _narrative, ...resource } = org;
  const notices: string[] = [];
  if (!hasTefcaId(org)) {
    resource.identifier = [...(org.identifier ?? []), PLACEHOLDER_TEFCA_ID];
    notices.push("No TEFCA ID yet. Sequoia assigns it when the entry is created, so it isn't checked here.");
  }

  const [outcome, sd] = await Promise.all([fhir.validate(resource, profile), loadProfile(profile)]);

  const errors: ConformanceIssue[] = [];
  const warnings: ConformanceIssue[] = [];
  for (const issue of outcome.issue ?? []) {
    const message = issue.diagnostics ?? issue.details?.text ?? issue.code;
    const path = issue.expression?.[0] ?? issue.location?.[0] ?? "Organization";
    if (issue.severity === "error" || issue.severity === "fatal") {
      errors.push({ source: "profile", path, message });
    } else if (issue.severity === "warning" && !IGNORED_WARNINGS.some((re) => re.test(message))) {
      warnings.push({ source: "profile", path, message });
    }
  }

  if (sd) {
    warnings.push(...missingMustSupport(org, sd));
  } else {
    warnings.push({ source: "must-support", path: profile, message: "Profile isn't loaded on the server, so Must Support wasn't checked" });
  }

  return { profile, errors, warnings, notices, passes: errors.length === 0 };
}

/** Run checkConformance over many orgs, a few requests at a time. */
export async function checkAllConformance(
  orgs: fhir4.Organization[],
  concurrency = 4,
): Promise<Map<string, ConformanceResult>> {
  const out = new Map<string, ConformanceResult>();
  let next = 0;
  async function worker() {
    while (next < orgs.length) {
      const org = orgs[next++];
      out.set(org.id!, await checkConformance(org));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, orgs.length) }, worker));
  return out;
}

/**
 * Must Support elements with no value. Only optional elements (min 0) are
 * listed, since required ones already fail cardinality, and only where the
 * parent element is present: a Must Support child of an absent contact
 * can't be filled in on its own.
 */
export function missingMustSupport(org: fhir4.Organization, sd: fhir4.StructureDefinition): ConformanceIssue[] {
  const elements = sd.snapshot?.element ?? [];
  const byId = new Map(elements.map((e) => [e.id ?? e.path, e]));
  const out: ConformanceIssue[] = [];

  for (const el of elements) {
    const id = el.id ?? el.path;
    if (!el.mustSupport || el.max === "0" || (el.min ?? 0) > 0) continue;
    const cut = id.lastIndexOf(".");
    if (cut < 0) continue;
    const parents = select(org, id.slice(0, cut), byId);
    if (parents.length === 0) continue;
    if (parents.some((p) => step(p, id.slice(cut + 1), id, byId).length === 0)) {
      out.push({ source: "must-support", path: id, message: "Must Support element not populated" });
    }
  }
  return out;
}

type Node = Record<string, unknown>;

/** Values at an element id like "Organization.address:us.city". */
function select(root: unknown, id: string, byId: Map<string, fhir4.ElementDefinition>): unknown[] {
  const parts = id.split(".");
  let values: unknown[] = [root];
  for (let i = 1; i < parts.length; i++) {
    const upTo = parts.slice(0, i + 1).join(".");
    values = values.flatMap((v) => step(v, parts[i], upTo, byId));
  }
  return values;
}

/** One path step: the child values named by `part`, narrowed to its slice. */
function step(value: unknown, part: string, elementId: string, byId: Map<string, fhir4.ElementDefinition>): unknown[] {
  if (value === null || typeof value !== "object") return [];
  const [name, slice] = part.split(":");
  const node = value as Node;
  let raw: unknown[];
  if (name.endsWith("[x]")) {
    const stem = name.slice(0, -3);
    raw = Object.keys(node)
      .filter((k) => k.startsWith(stem) && /^[A-Z]/.test(k.slice(stem.length)))
      .map((k) => node[k]);
  } else {
    raw = node[name] === undefined ? [] : [node[name]];
  }
  const items = raw.flatMap((r) => (Array.isArray(r) ? r : [r]));
  if (!slice) return items;
  const el = byId.get(elementId);
  return el ? items.filter((item) => inSlice(item, name, el)) : items;
}

/**
 * Whether a value belongs to a slice. Extensions match on url; other slices
 * on their pattern or fixed value. A slice with neither can't be told apart
 * here, so every value counts.
 */
function inSlice(item: unknown, name: string, el: fhir4.ElementDefinition): boolean {
  if (name === "extension" || name === "modifierExtension") {
    const url = el.type?.[0]?.profile?.[0];
    return !url || (item as Node)?.url === url;
  }
  const key = Object.keys(el).find((k) => k.startsWith("pattern") || k.startsWith("fixed"));
  return key ? contains(item, (el as unknown as Node)[key]) : true;
}

/** Pattern match: everything in `pattern` is present in `value`. */
function contains(value: unknown, pattern: unknown): boolean {
  if (pattern === null || typeof pattern !== "object") return value === pattern;
  if (Array.isArray(pattern)) {
    return Array.isArray(value) && pattern.every((p) => value.some((v) => contains(v, p)));
  }
  if (value === null || typeof value !== "object") return false;
  return Object.entries(pattern as Node).every(([k, p]) => contains((value as Node)[k], p));
}
