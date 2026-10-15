import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAllOrganizations } from "../../hooks/useOrganizations";
import { roleOf } from "../../lib/rce-profiles";
import { usePreviewSubmitter } from "../../lib/verification/submitters";
import { checkAllConformance, checkConformance, type ConformanceIssue, type ConformanceResult } from "../../lib/verification/conformance";
import ProfileBadge from "../../components/ProfileBadge";
import ErrorBanner from "../../components/ErrorBanner";
import Spinner from "../../components/Spinner";
import StatCard from "../../components/StatCard";
import { CheckChip, LiveBadge } from "../../components/verification/StatusChip";

/**
 * What a submitter sees for Level 1: every entry they manage, checked against
 * the RCE FHIR IG (cardinality, required slices, fixed values, profile rules,
 * Must Support). Entries have to pass before Level 2 identity checks.
 */
export default function SubmitterLevel1Page() {
  const q = useAllOrganizations();
  const orgs = useMemo(() => q.data ?? [], [q.data]);

  const { submitters, submitter, entries, setSubmitterId } = usePreviewSubmitter(orgs, "QHIN Alpha");
  const versionKey = entries.map((o) => `${o.id}@${o.meta?.versionId ?? ""}`).join(",");
  const level1 = useQuery({
    queryKey: ["conformance", versionKey],
    enabled: entries.length > 0,
    staleTime: Infinity,
    queryFn: () => checkAllConformance(entries),
  });

  const [selectedId, setSelectedId] = useState("");

  if (q.isLoading) return <Spinner label="Loading your entries..." />;
  if (q.isError) return <ErrorBanner title="Couldn't reach the FHIR server" error={q.error} />;

  const results = level1.data;
  const sorted = results
    ? [...entries].sort((a, b) => results.get(b.id!)!.errors.length - results.get(a.id!)!.errors.length)
    : entries;
  const selected = sorted.find((o) => o.id === selectedId) ?? sorted[0];
  const passing = results ? entries.filter((o) => results.get(o.id!)!.passes).length : 0;
  const withGaps = results ? entries.filter((o) => msGaps(results.get(o.id!)!).length > 0).length : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          {submitters.length > 0 && (
            <>
              <label htmlFor="as-submitter">Previewing as</label>
              <select
                id="as-submitter"
                className="input w-auto py-1"
                value={submitter?.id ?? ""}
                onChange={(e) => {
                  setSubmitterId(e.target.value);
                  setSelectedId("");
                }}
              >
                {submitters.map((s) => (
                  <option key={s.id} value={s.id}>{s.name ?? s.id}</option>
                ))}
              </select>
            </>
          )}
          <LiveBadge />
        </div>
        <h1 className="text-2xl font-semibold">Level 1 validation</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Every entry you submit is checked against the RCE FHIR Implementation Guide: required elements and how many of each, the
          right identifier and code slices, fixed values, and the guide's rules. Entries with errors can't go on to identity
          verification (Level 2) until they're fixed. Must Support gaps are recommendations, not blockers.
        </p>
      </header>

      {submitters.length === 0 ? (
        <div className="card p-5 text-sm text-slate-600">
          No organizations on the server to preview as. Seed sample data from the{" "}
          <Link to="/" className="underline">Dashboard</Link>.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Your entries" value={entries.length} />
            <StatCard label="Pass Level 1" value={results ? passing : "…"} sub="Ready for identity checks" accent="#047857" />
            <StatCard label="Need fixes" value={results ? entries.length - passing : "…"} sub="At least one error" accent="#b91c1c" />
            <StatCard label="Must Support gaps" value={results ? withGaps : "…"} sub="Entries with recommended fields empty" accent="#b88a00" />
          </div>

          {level1.isError && <ErrorBanner title="Validation failed" error={level1.error} />}
          {level1.isLoading && <Spinner label="Validating your entries against the RCE IG..." />}

          {results && selected && (
            <div className="grid gap-5 lg:grid-cols-3">
              <section className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-semibold">Your entries</h2>
                  <span className="text-xs text-slate-500">Most errors first</span>
                </div>
                {sorted.map((o) => {
                  const r = results.get(o.id!)!;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={o.id === selected.id}
                      onClick={() => setSelectedId(o.id!)}
                      className={`card block w-full space-y-1.5 p-4 text-left hover:bg-slate-50 ${o.id === selected.id ? "ring-2 ring-slate-900" : ""}`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="text-sm font-semibold">{o.name ?? `(unnamed) ${o.id}`}</span>
                        <CheckChip result={r.passes ? "pass" : "fail"} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <ProfileBadge role={roleOf(o)} />
                        <span>
                          {r.errors.length} error{r.errors.length === 1 ? "" : "s"} · {msGaps(r).length} Must Support gap
                          {msGaps(r).length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </section>

              <section className="card space-y-5 p-6 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs text-slate-500">Organization/{selected.id}</div>
                    <h2 className="text-xl font-semibold">{selected.name ?? "(unnamed)"}</h2>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" onClick={() => level1.refetch()} disabled={level1.isFetching}>
                      {level1.isFetching ? "Validating..." : "Revalidate"}
                    </button>
                    <Link to={`/organization/${selected.id}/edit`} className="btn-primary">Edit entry</Link>
                  </div>
                </div>
                <Findings result={results.get(selected.id!)!} />
              </section>
            </div>
          )}
        </>
      )}

      <PasteCheck />
    </div>
  );
}

/** Lets a submitter validate an Organization before submitting it. Nothing is saved. */
function PasteCheck() {
  const [text, setText] = useState("");
  const [parseError, setParseError] = useState("");
  const check = useQuery({
    queryKey: ["conformance-paste", text],
    enabled: false,
    queryFn: () => checkConformance(JSON.parse(text) as fhir4.Organization),
  });

  function run() {
    try {
      const r = JSON.parse(text);
      if (r?.resourceType !== "Organization") {
        setParseError("Paste a single Organization resource (resourceType \"Organization\").");
        return;
      }
    } catch {
      setParseError("That isn't valid JSON.");
      return;
    }
    setParseError("");
    check.refetch();
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="font-semibold">Check an entry before you submit it</h2>
        <p className="text-sm text-slate-500">
          Paste an Organization as FHIR JSON. It's validated against the profile in its meta.profile, the same check your submitted
          entries get. Nothing is saved.
        </p>
      </div>
      <label htmlFor="paste" className="label">Organization JSON</label>
      <textarea
        id="paste"
        rows={8}
        className="input font-mono text-xs"
        placeholder='{ "resourceType": "Organization", "meta": { "profile": ["https://sequoiaproject.org/fhir/rce/StructureDefinition/Participant"] }, ... }'
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-red-700">{parseError}</p>
        <button type="button" className="btn-primary" disabled={!text.trim() || check.isFetching} onClick={run}>
          {check.isFetching ? "Validating..." : "Validate"}
        </button>
      </div>
      {check.isError && <ErrorBanner title="Validation failed" error={check.error} />}
      {check.data && !parseError && <Findings result={check.data} />}
    </section>
  );
}

function Findings({ result }: { result: ConformanceResult }) {
  const gaps = msGaps(result);
  const other = result.warnings.filter((w) => w.source !== "must-support");
  return (
    <div className="space-y-5">
      <div
        className={`rounded-lg px-4 py-3 text-sm ${result.passes ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : "bg-red-50 text-red-900 ring-1 ring-red-200"}`}
      >
        <span className="font-semibold">{result.passes ? "Passes Level 1." : "Doesn't pass Level 1 yet."}</span>{" "}
        {result.passes
          ? "This entry conforms to the RCE IG and can go on to identity verification."
          : `Fix the ${result.errors.length} error${result.errors.length === 1 ? "" : "s"} below and resubmit.`}
        {result.profile && <div className="mt-1 font-mono text-xs opacity-75">Validated against {result.profile.split("/").pop()}</div>}
      </div>

      {result.notices.map((n) => (
        <p key={n} className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200">{n}</p>
      ))}

      <IssueList title="Errors · must fix" tone="text-red-700" issues={result.errors} empty="No errors." />
      <IssueList
        title="Must Support · recommended"
        tone="text-amber-800"
        issues={gaps}
        empty="Every Must Support element that applies is filled in."
        note="The IG marks these as Must Support. They aren't required, but directory users rely on them when present."
      />
      {other.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">Other warnings ({other.length})</summary>
          <div className="mt-2">
            <IssueList issues={other} tone="text-slate-600" />
          </div>
        </details>
      )}
    </div>
  );
}

function IssueList({
  title,
  tone,
  issues,
  empty,
  note,
}: {
  title?: string;
  tone: string;
  issues: ConformanceIssue[];
  empty?: string;
  note?: string;
}) {
  return (
    <div className="space-y-2">
      {title && (
        <h3 className={`text-sm font-semibold ${tone}`}>
          {title} <span className="font-normal text-slate-400">({issues.length})</span>
        </h3>
      )}
      {note && issues.length > 0 && <p className="text-xs text-slate-500">{note}</p>}
      {issues.length === 0 ? (
        empty && <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          {issues.map((i, n) => (
            <li key={n} className="space-y-0.5 px-3 py-2">
              <div className="break-all font-mono text-xs text-slate-500">{i.path}</div>
              <div className="text-sm text-slate-800">{plain(i.message)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function msGaps(r: ConformanceResult) {
  return r.warnings.filter((w) => w.source === "must-support");
}

/** Drop the validator's "(from https://...|1.12.0)" profile suffix; the panel already names the profile. */
function plain(message: string) {
  return message.replace(/\s*\(from https?:\/\/[^)]*\)/g, "").replace(/\s*\(defined in [^)]*\)/g, "");
}
