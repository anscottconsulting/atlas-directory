/**
 * Field rules run against the live directory (HAPI Organizations).
 *
 * Each rule returns null when the organization passes, or a short message
 * describing the failure. Rules marked `vetting: true` are the ones an entry
 * has to pass before it can go to identity verification.
 */

import {
  containedEndpoint,
  partOfId,
  roleOf,
  RULES,
  type RceRole,
} from "../rce-profiles";

export const TEFCA_ID_SYSTEM = "urn:oid:2.16.840.1.113883.3.7204.1.5.1.1";
export const NPI_SYSTEM = "http://hl7.org/fhir/sid/us-npi";

const OID_RE = /^[0-2](\.(0|[1-9]\d*))+$/;
const PLACEHOLDER_RE = /^\s*(test|tbd|todo|n\/?a|unknown|placeholder|xxx+)\b/i;

/** NPI check digit: Luhn over "80840" + first nine digits. */
export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = ("80840" + npi.slice(0, 9)).split("").map(Number);
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10 === Number(npi[9]);
}

export function tefcaIdOf(org: fhir4.Organization): string | undefined {
  return org.identifier?.find((i) => i.system === TEFCA_ID_SYSTEM)?.value;
}

export function npiOf(org: fhir4.Organization): string | undefined {
  return org.identifier?.find((i) => i.system === NPI_SYSTEM)?.value;
}

export interface RuleContext {
  byId: Map<string, fhir4.Organization>;
  tefcaIdCounts: Map<string, number>;
}

export function buildContext(orgs: fhir4.Organization[]): RuleContext {
  const byId = new Map<string, fhir4.Organization>();
  const tefcaIdCounts = new Map<string, number>();
  for (const o of orgs) {
    if (o.id) byId.set(o.id, o);
    const t = tefcaIdOf(o);
    if (t) tefcaIdCounts.set(t, (tefcaIdCounts.get(t) ?? 0) + 1);
  }
  return { byId, tefcaIdCounts };
}

export interface FieldRule {
  id: string;
  field: string;
  format: string;
  cardinality: string;
  rule: string;
  vetting: boolean;
  fixWindow: string;
  check: (org: fhir4.Organization, ctx: RuleContext) => string | null;
}

export const FIELD_RULES: FieldRule[] = [
  {
    id: "name",
    field: "Organization name",
    format: "string",
    cardinality: "1..1",
    rule: "Present, not a placeholder like TEST or TBD",
    vetting: true,
    fixWindow: "30 days",
    check: (o) => {
      if (!o.name?.trim()) return "Name is missing";
      if (PLACEHOLDER_RE.test(o.name)) return `Placeholder name "${o.name}"`;
      return null;
    },
  },
  {
    id: "role",
    field: "Directory role",
    format: "meta.profile",
    cardinality: "1..1",
    rule: "Declares one of the four organization profiles",
    vetting: true,
    fixWindow: "30 days",
    check: (o) => (roleOf(o) === "Unknown" ? "No role profile in meta.profile" : null),
  },
  {
    id: "tefca-id",
    field: "TEFCA ID",
    format: "OID",
    cardinality: "1..1",
    rule: "Present with the TEFCA ID system, valid OID syntax",
    vetting: true,
    fixWindow: "30 days",
    check: (o) => {
      const t = tefcaIdOf(o);
      if (!t) return "No identifier with the TEFCA ID system";
      if (!OID_RE.test(t)) return `"${t}" is not a valid OID`;
      return null;
    },
  },
  {
    id: "tefca-id-unique",
    field: "TEFCA ID",
    format: "OID",
    cardinality: "unique",
    rule: "Not used by any other organization in the directory",
    vetting: true,
    fixWindow: "30 days",
    check: (o, ctx) => {
      const t = tefcaIdOf(o);
      if (!t) return null;
      const n = ctx.tefcaIdCounts.get(t) ?? 0;
      return n > 1 ? `Shared with ${n - 1} other organization${n > 2 ? "s" : ""}` : null;
    },
  },
  {
    id: "npi",
    field: "NPI",
    format: "10 digits",
    cardinality: "0..1",
    rule: "When present, passes the NPI check digit",
    vetting: true,
    fixWindow: "30 days",
    check: (o) => {
      const npi = npiOf(o);
      if (!npi) return null;
      return isValidNpi(npi) ? null : `NPI ${npi} fails the check digit`;
    },
  },
  {
    id: "address",
    field: "Address",
    format: "Address",
    cardinality: "1..1",
    rule: "Has street line, city, state and postal code",
    vetting: true,
    fixWindow: "30 days",
    check: (o) => {
      const a = o.address?.[0];
      if (!a) return "No address";
      const missing = [
        !a.line?.length && "street",
        !a.city && "city",
        !a.state && "state",
        !a.postalCode && "postal code",
      ].filter(Boolean);
      return missing.length ? `Address missing ${missing.join(", ")}` : null;
    },
  },
  {
    id: "parent",
    field: "Parent (partOf)",
    format: "Reference(Organization)",
    cardinality: "1..1 below QHIN",
    rule: "Resolves to an organization whose role is a valid parent",
    vetting: true,
    fixWindow: "30 days",
    check: (o, ctx) => {
      const role = roleOf(o);
      const pid = partOfId(o);
      if (role === "Unknown") return null;
      if (!RULES.allowsPartOf(role)) return pid ? "QHIN must not have a parent" : null;
      if (!pid) return "No parent reference";
      const parent = ctx.byId.get(pid);
      if (!parent) return `Parent Organization/${pid} not found`;
      const prole = roleOf(parent);
      if (prole === "Unknown") return "Parent has no role profile";
      if (!RULES.validParents(role as RceRole).includes(prole)) {
        return `${role} cannot sit under a ${prole}`;
      }
      return null;
    },
  },
  {
    id: "endpoint",
    field: "Endpoint",
    format: "https URL",
    cardinality: "0..* (none for Child)",
    rule: "Child entries have no endpoint; others use https",
    vetting: false,
    fixWindow: "90 days",
    check: (o) => {
      const role = roleOf(o);
      const hasEndpoint = (o.endpoint?.length ?? 0) > 0;
      if (role !== "Unknown" && !RULES.allowsEndpoint(role) && hasEndpoint) {
        return "Child entry has an endpoint";
      }
      const ep = containedEndpoint(o);
      if (ep?.address && !ep.address.startsWith("https://")) {
        return `Endpoint is not https (${ep.address})`;
      }
      return null;
    },
  },
];

export interface OrgResult {
  org: fhir4.Organization;
  failures: { rule: FieldRule; message: string }[];
  vettingReady: boolean;
}

export function evaluate(orgs: fhir4.Organization[]): OrgResult[] {
  const ctx = buildContext(orgs);
  return orgs.map((org) => {
    const failures = FIELD_RULES.flatMap((rule) => {
      const message = rule.check(org, ctx);
      return message ? [{ rule, message }] : [];
    });
    return {
      org,
      failures,
      vettingReady: !failures.some((f) => f.rule.vetting),
    };
  });
}
