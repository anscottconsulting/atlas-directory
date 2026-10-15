/**
 * Who a submitter view can preview as, and which entries each one manages.
 * Shared by the Level 1 and Level 2 submitter tabs.
 */

import { useMemo, useState } from "react";
import { partOfId, roleOf } from "../rce-profiles";

/**
 * Submitters are the organizations that manage a hierarchy: QHINs,
 * Participants, and any top-level entry (one with no parent), even without
 * an RCE profile, so unprofiled data still shows up.
 */
export function submittersOf(orgs: fhir4.Organization[]): fhir4.Organization[] {
  return orgs
    .filter((o) => ["QHIN", "Participant"].includes(roleOf(o)) || !partOfId(o))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

/** The submitter plus everything below it via partOf. */
export function hierarchy(root: fhir4.Organization, all: fhir4.Organization[]): fhir4.Organization[] {
  const children = new Map<string, fhir4.Organization[]>();
  for (const o of all) {
    const p = partOfId(o);
    if (p) children.set(p, [...(children.get(p) ?? []), o]);
  }
  const out: fhir4.Organization[] = [];
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length) {
    const o = stack.pop()!;
    if (!o.id || seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
    stack.push(...(children.get(o.id) ?? []));
  }
  return out;
}

/**
 * The "Previewing as" selection. Starts on the submitter named `preferred`
 * when there is one, otherwise the first.
 */
export function usePreviewSubmitter(orgs: fhir4.Organization[], preferred: string) {
  const submitters = useMemo(() => submittersOf(orgs), [orgs]);
  const [chosenId, setChosenId] = useState("");
  const submitter =
    submitters.find((s) => s.id === chosenId) ?? submitters.find((s) => s.name === preferred) ?? submitters[0];
  const entries = useMemo(() => (submitter ? hierarchy(submitter, orgs) : []), [submitter, orgs]);
  return { submitters, submitter, entries, setSubmitterId: setChosenId };
}
