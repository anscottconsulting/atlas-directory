/**
 * Profile URLs and helpers for the RCE Directory IG.
 *
 * In the RCE IG, all four organization roles are the same FHIR resource
 * (Organization) — distinguished only by meta.profile.
 */

export const PROFILE = {
  QHIN: "https://sequoiaproject.org/fhir/rce/StructureDefinition/QHIN",
  Participant:
    "https://sequoiaproject.org/fhir/rce/StructureDefinition/Participant",
  Subparticipant:
    "https://sequoiaproject.org/fhir/rce/StructureDefinition/SubParticipant",
  Child: "https://sequoiaproject.org/fhir/rce/StructureDefinition/Child",
  Endpoint:
    "https://sequoiaproject.org/fhir/rce/StructureDefinition/RCE-Endpoint",
} as const;

export type RceRole = "QHIN" | "Participant" | "Subparticipant" | "Child";

export const ROLES: RceRole[] = [
  "QHIN",
  "Participant",
  "Subparticipant",
  "Child",
];

/** Determine an Organization's RCE role from its meta.profile. */
export function roleOf(
  org: fhir4.Organization | undefined,
): RceRole | "Unknown" {
  if (!org) return "Unknown";
  const profiles = org.meta?.profile ?? [];
  if (profiles.includes(PROFILE.QHIN)) return "QHIN";
  if (profiles.includes(PROFILE.Participant)) return "Participant";
  if (profiles.includes(PROFILE.Subparticipant)) return "Subparticipant";
  if (profiles.includes(PROFILE.Child)) return "Child";
  return "Unknown";
}

/** Set the role on an Organization (replaces any RCE profile already set). */
export function setRole(
  org: fhir4.Organization,
  role: RceRole,
): fhir4.Organization {
  const others = (org.meta?.profile ?? []).filter(
    (p) =>
      p !== PROFILE.QHIN &&
      p !== PROFILE.Participant &&
      p !== PROFILE.Subparticipant &&
      p !== PROFILE.Child,
  );
  return {
    ...org,
    meta: { ...(org.meta ?? {}), profile: [...others, PROFILE[role]] },
  };
}

export const ROLE_COLORS: Record<RceRole | "Unknown", string> = {
  QHIN: "#7c3aed",
  Participant: "#2563eb",
  Subparticipant: "#0891b2",
  Child: "#16a34a",
  Unknown: "#64748b",
};

/** UI rules from the IG. */
export const RULES = {
  /** Children cannot have endpoints. */
  allowsEndpoint: (role: RceRole | "Unknown") => role !== "Child",
  /** QHINs are top-level; they cannot have a partOf. */
  allowsPartOf: (role: RceRole | "Unknown") => role !== "QHIN",
  /** Which roles a given role can be a child of (informational). */
  validParents: (role: RceRole): RceRole[] => {
    switch (role) {
      case "QHIN":
        return [];
      case "Participant":
        return ["QHIN"];
      case "Subparticipant":
        return ["Participant", "Subparticipant"];
      case "Child":
        return ["QHIN", "Participant", "Subparticipant", "Child"];
    }
  },
};

/** Extract the referenced Organization ID from an Organization.partOf reference. */
export function partOfId(
  org: fhir4.Organization | undefined,
): string | undefined {
  const ref = org?.partOf?.reference;
  if (!ref) return undefined;
  // Accept "Organization/123" or absolute URLs ending in Organization/123
  const m = ref.match(/Organization\/([^/?]+)/);
  return m?.[1];
}

/** Resolve a contained Endpoint reference like "#endpoint1". */
export function containedEndpoint(
  org: fhir4.Organization | undefined,
): fhir4.Endpoint | undefined {
  const ref = org?.endpoint?.[0]?.reference;
  if (!ref?.startsWith("#")) return undefined;
  const id = ref.slice(1);
  return org?.contained?.find(
    (r) => r.resourceType === "Endpoint" && r.id === id,
  ) as fhir4.Endpoint | undefined;
}
