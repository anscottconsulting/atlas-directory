/**
 * Wrappers for the three custom operations defined by the RCE IG.
 * Each cascades across an Organization and its descendants via partOf.
 *
 * Note: HAPI does not implement these operations out of the box. If the server
 * returns a 404 / 400 for the operation, the UI falls back to performing the
 * effect client-side by fetching descendants and PUTting each one.
 */

import { fhir, bundleEntries } from "./fhir-client";

/** Collect this org plus all transitive descendants by partOf. */
export async function collectHierarchy(
  rootId: string,
): Promise<fhir4.Organization[]> {
  const seen = new Map<string, fhir4.Organization>();
  const root = await fhir.read<fhir4.Organization>("Organization", rootId);
  seen.set(rootId, root);

  // Walk down. HAPI supports the "partof" search param on Organization.
  const frontier = [rootId];
  while (frontier.length) {
    const next = frontier.shift()!;
    const bundle = await fhir.search<fhir4.Organization>("Organization", {
      partof: `Organization/${next}`,
      _count: 200,
    });
    for (const child of bundleEntries(bundle)) {
      if (child.id && !seen.has(child.id)) {
        seen.set(child.id, child);
        frontier.push(child.id);
      }
    }
  }
  return [...seen.values()];
}

async function fallbackToggleActive(
  rootId: string,
  active: boolean,
): Promise<number> {
  const all = await collectHierarchy(rootId);
  await Promise.all(
    all.map((o) =>
      fhir.update<fhir4.Organization>({ ...o, active }),
    ),
  );
  return all.length;
}

async function tryOperation(
  rootId: string,
  op: "$activate-hierarchy" | "$deactivate-hierarchy",
): Promise<boolean> {
  try {
    await fhir.operation("Organization", op, rootId);
    return true;
  } catch {
    return false;
  }
}

export async function activateHierarchy(rootId: string): Promise<{
  used: "server" | "client";
  count: number;
}> {
  if (await tryOperation(rootId, "$activate-hierarchy")) {
    const all = await collectHierarchy(rootId);
    return { used: "server", count: all.length };
  }
  const count = await fallbackToggleActive(rootId, true);
  return { used: "client", count };
}

export async function deactivateHierarchy(rootId: string): Promise<{
  used: "server" | "client";
  count: number;
}> {
  if (await tryOperation(rootId, "$deactivate-hierarchy")) {
    const all = await collectHierarchy(rootId);
    return { used: "server", count: all.length };
  }
  const count = await fallbackToggleActive(rootId, false);
  return { used: "client", count };
}

const TEFCAID_SYSTEM = "urn:oid:2.16.840.1.113883.3.7204.1.5.1.1";

export async function updateTefcaId(
  rootId: string,
  newValue: string,
): Promise<{ used: "server" | "client"; count: number }> {
  // Try the server operation first
  try {
    await fhir.operation("Organization", "$update-tefcaid", rootId, {
      resourceType: "Parameters",
      parameter: [{ name: "tefcaid", valueString: newValue }],
    });
    const all = await collectHierarchy(rootId);
    return { used: "server", count: all.length };
  } catch {
    // Fallback: rewrite the identifier on every descendant
    const all = await collectHierarchy(rootId);
    await Promise.all(
      all.map((o) => {
        const others = (o.identifier ?? []).filter(
          (i) => i.system !== TEFCAID_SYSTEM,
        );
        const updated: fhir4.Organization = {
          ...o,
          identifier: [
            ...others,
            { system: TEFCAID_SYSTEM, value: newValue },
          ],
        };
        return fhir.update<fhir4.Organization>(updated);
      }),
    );
    return { used: "client", count: all.length };
  }
}
