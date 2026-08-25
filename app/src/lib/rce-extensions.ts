/**
 * Extension URLs defined by the Sequoia Project Healthcare Directory IG
 * and used by the RCE Directory IG.
 *
 * We surface a handful as form fields. The rest pass through untouched on
 * round-trip via the raw JSON editor.
 */

const SPHD = "https://sequoiaproject.org/fhir/sphd/StructureDefinition";

export const EXT = {
  Domains: `${SPHD}/Domains`,
  InitiatorOnly: `${SPHD}/InitiatorOnly`,
  OrgManagingOrg: `${SPHD}/org-managing-org`,
  PurposesOfUse: `${SPHD}/PurposesOfUse`,
  StateOfOperation: `${SPHD}/StateOfOperation`,
  UseCases: `${SPHD}/UseCases`,
} as const;

/** Look up the first extension matching a URL on a resource (or element). */
export function getExtension(
  ext: fhir4.Extension[] | undefined,
  url: string,
): fhir4.Extension | undefined {
  return ext?.find((e) => e.url === url);
}

/** Get all extensions on this URL. */
export function getExtensions(
  ext: fhir4.Extension[] | undefined,
  url: string,
): fhir4.Extension[] {
  return ext?.filter((e) => e.url === url) ?? [];
}

/** Read the first valueString-like field from an Extension. */
export function readStringExt(e: fhir4.Extension | undefined): string | undefined {
  return (
    e?.valueString ??
    e?.valueCode ??
    e?.valueCoding?.code ??
    e?.valueCodeableConcept?.coding?.[0]?.code
  );
}
