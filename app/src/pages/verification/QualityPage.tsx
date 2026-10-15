import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAllOrganizations } from "../../hooks/useOrganizations";
import { roleOf } from "../../lib/rce-profiles";
import { evaluate, FIELD_RULES } from "../../lib/verification/rules";
import { checkAllConformance, type ConformanceResult } from "../../lib/verification/conformance";
import { verifyAll } from "../../lib/verification/identity";
import ProfileBadge from "../../components/ProfileBadge";
import ErrorBanner from "../../components/ErrorBanner";
import Spinner from "../../components/Spinner";
import StatCard from "../../components/StatCard";
import { CheckChip, LiveBadge, StatusChip } from "../../components/verification/StatusChip";

/** Proposed directory flags and who can see them. Not stored anywhere yet. */
const FLAGS = [
  { name: "Vetting status", values: "submitted | being vetted | failed | approved", visibility: "all" },
  { name: "Passed covered-entity validation (internal use only)", values: "true | false", visibility: "staff" },
  { name: "Data quality issues present", values: "true | false", visibility: "staff" },
  { name: "Awaiting submitter update", values: "true | false, with due date", visibility: "staff" },
];

export default function QualityPage() {
  const q = useAllOrganizations();
  const [ruleFilter, setRuleFilter] = useState<string>("");
  const [flagVis, setFlagVis] = useState(() => FLAGS.map((f) => f.visibility));
  const [open, setOpen] = useState<string>("");
  const [includeFailing, setIncludeFailing] = useState(false);

  const orgs = useMemo(() => q.data ?? [], [q.data]);
  const rules = useMemo(() => evaluate(orgs), [orgs]);
  // Keyed on each org's version so an edit reruns its checks.
  const versionKey = orgs.map((o) => `${o.id}@${o.meta?.versionId ?? ""}`).join(",");

  const level1 = useQuery({
    queryKey: ["conformance", versionKey],
    enabled: orgs.length > 0,
    staleTime: Infinity,
    queryFn: () => checkAllConformance(orgs),
  });

  const conformance = level1.data;
  const level2Items = useMemo(
    () => rules.filter((r) => conformance && (includeFailing || conformance.get(r.org.id!)?.passes)),
    [rules, conformance, includeFailing],
  );
  const level2 = useQuery({
    queryKey: ["identity", versionKey, level2Items.map((r) => r.org.id).join(",")],
    enabled: level2Items.length > 0,
    staleTime: Infinity,
    queryFn: () => verifyAll(level2Items.map((r) => ({ org: r.org, rules: r }))),
  });

  if (q.isLoading) return <Spinner label="Loading directory entries..." />;
  if (q.isError) return <ErrorBanner title="Couldn't reach the FHIR server" error={q.error} />;

  const results = conformance ? orgs.map((org) => ({ org, c: conformance.get(org.id!)! })) : [];
  const conformant = results.filter((r) => r.c.passes).length;
  const identity = level2.data;
  const statuses = identity ? [...identity.values()].map((r) => r.status) : [];
  const count = (s: string) => statuses.filter((x) => x === s).length;
  const failingByRule = new Map(FIELD_RULES.map((rule) => [rule.id, rules.filter((r) => r.failures.some((f) => f.rule.id === rule.id)).length]));
  const level2Rows = level2Items.filter((r) => !ruleFilter || r.failures.some((f) => f.rule.id === ruleFilter));

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1"><LiveBadge /></div>
        <h1 className="text-2xl font-semibold">Data quality and validation</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Two levels, run against every organization on the server. Level 1 checks each entry against its RCE profile. Entries that
          pass go on to Level 2, which checks the NPI against NPPES, the EIN, and the directory rules.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Organizations" value={orgs.length} />
        <StatCard label="Level 1 · conformant" value={conformance ? conformant : "…"} sub="No profile errors" accent="#047857" />
        <StatCard label="Level 1 · failing" value={conformance ? orgs.length - conformant : "…"} sub="Fix before Level 2" accent="#b88a00" />
        <StatCard label="Level 2 · verified" value={identity ? count("verified") : "–"} sub="Identity checks pass" accent="#047857" />
        <StatCard
          label="Level 2 · follow-up"
          value={identity ? count("partial") + count("unable") : "–"}
          sub={identity ? `${count("partial")} partial · ${count("unable")} unable` : "Runs after Level 1"}
          accent="#b88a00"
        />
      </div>

      {orgs.length === 0 && (
        <div className="card p-5 text-sm text-slate-600">
          No organizations on the server yet. Seed sample data from the <Link to="/" className="underline">Dashboard</Link>.
        </div>
      )}

      {orgs.length > 0 && (
        <section className="card overflow-hidden">
          <div className="space-y-1 px-5 pt-5 pb-3">
            <h2 className="font-semibold">Level 1 · Base conformance</h2>
            <p className="text-sm text-slate-500">
              Validated by the FHIR server against the entry's RCE profile: cardinality, required slices, fixed values and profile
              rules. Errors block Level 2. Must Support elements that aren't filled in are warnings only.
            </p>
          </div>
          {level1.isLoading && <div className="px-5 pb-5"><Spinner label="Validating against the RCE profiles..." /></div>}
          {level1.isError && <div className="px-5 pb-5"><ErrorBanner title="Profile validation failed" error={level1.error} /></div>}
          {conformance && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="px-4 py-2 font-medium">Organization</th>
                    <th className="px-4 py-2 font-medium">Role</th>
                    <th className="px-4 py-2 text-right font-medium">Errors</th>
                    <th className="px-4 py-2 text-right font-medium">Must Support gaps</th>
                    <th className="px-4 py-2 text-right font-medium">Other warnings</th>
                    <th className="px-4 py-2 font-medium">Result</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(({ org, c }) => {
                    const ms = c.warnings.filter((w) => w.source === "must-support").length;
                    const expanded = open === org.id;
                    return (
                      <ConformanceRow
                        key={org.id}
                        org={org}
                        c={c}
                        ms={ms}
                        expanded={expanded}
                        onToggle={() => setOpen(expanded ? "" : org.id!)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {orgs.length > 0 && conformance && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
            <div className="max-w-3xl space-y-1">
              <h2 className="font-semibold">Level 2 · Intelligent validation</h2>
              <p className="text-sm text-slate-500">
                NPI looked up in the NPPES registry: it must exist, be active, belong to an organization, and match the entry's name and
                state. EIN format is checked here; ownership is confirmed with an IRS letter from the submitter.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={includeFailing} onChange={(e) => setIncludeFailing(e.target.checked)} />
              Include entries failing Level 1
            </label>
          </div>
          {level2Items.length === 0 ? (
            <div className="px-5 pb-5 text-sm text-slate-500">
              No entries pass Level 1 yet, so nothing has gone to Level 2. Tick the box above to preview Level 2 on all entries.
            </div>
          ) : level2.isLoading ? (
            <div className="px-5 pb-5"><Spinner label="Checking NPPES..." /></div>
          ) : level2.isError ? (
            <div className="px-5 pb-5"><ErrorBanner title="Identity checks failed" error={level2.error} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="px-4 py-2 font-medium">Organization</th>
                    <th className="px-4 py-2 font-medium">Checks</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {level2Rows.map((r) => {
                    const id = identity?.get(r.org.id!);
                    if (!id) return null;
                    return (
                      <tr key={r.org.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <Link to={`/organization/${r.org.id}`} className="hover:underline">{r.org.name ?? `(unnamed) ${r.org.id}`}</Link>
                          {!conformance.get(r.org.id!)?.passes && <div className="text-xs text-slate-400">Fails Level 1 (preview)</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          <ul className="space-y-1">
                            {id.checks.map((c, i) => (
                              <li key={i} className="flex gap-2 text-xs">
                                <span className="w-20 flex-none"><CheckChip result={c.result} /></span>
                                <span><span className="font-medium">{c.name}:</span> <span className="text-slate-600">{c.detail}</span></span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusChip status={id.status} short />
                          {id.evidenceNeeded && <div className="mt-1 text-xs text-sky-700">Evidence requested</div>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link to={`/organization/${r.org.id}/edit`} className="text-xs text-slate-500 hover:text-slate-900">Fix</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3">
          <h2 className="font-semibold">Level 2 directory rules</h2>
          <span className="text-xs text-slate-500">Click a rule to filter Level 2. Rules live in src/lib/verification/rules.ts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-4 py-2 font-medium">Field</th>
                <th className="px-4 py-2 font-medium">Rule</th>
                <th className="px-4 py-2 font-medium">Vetting</th>
                <th className="px-4 py-2 text-right font-medium">Failing</th>
                <th className="px-4 py-2 font-medium">Fix window</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_RULES.map((rule) => {
                const failing = failingByRule.get(rule.id) ?? 0;
                const active = ruleFilter === rule.id;
                return (
                  <tr key={rule.id} className={`border-b border-slate-100 ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}>
                    <td className="px-4 py-2 font-medium">
                      <button type="button" className="text-left hover:underline" onClick={() => setRuleFilter(active ? "" : rule.id)} aria-pressed={active}>
                        {rule.field}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{rule.rule}</td>
                    <td className="px-4 py-2">{rule.vetting ? "Yes" : "No"}</td>
                    <td className={`px-4 py-2 text-right font-mono ${failing ? "font-semibold text-amber-800" : "text-slate-400"}`}>{failing}</td>
                    <td className="px-4 py-2">{rule.fixWindow}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="font-semibold">Directory flags (proposed)</h2>
        <p className="text-sm text-slate-500">Who would see each flag. Internal flags never feed submitter business rules. Not written to the server yet.</p>
        {FLAGS.map((f, i) => (
          <div key={f.name} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
            <div>
              <div className="text-sm font-medium">{f.name}</div>
              <div className="font-mono text-xs text-slate-500">{f.values}</div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Visible to
              <select
                className="input w-auto"
                value={flagVis[i]}
                onChange={(e) => setFlagVis((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              >
                <option value="staff">Directory staff only</option>
                <option value="owner">Owning submitter</option>
                <option value="all">All directory users</option>
              </select>
            </label>
          </div>
        ))}
      </section>
    </div>
  );
}

function ConformanceRow({
  org,
  c,
  ms,
  expanded,
  onToggle,
}: {
  org: fhir4.Organization;
  c: ConformanceResult;
  ms: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const other = c.warnings.length - ms;
  const issues = [
    ...c.errors.map((i) => ({ ...i, level: "Error" })),
    ...c.warnings.map((i) => ({ ...i, level: i.source === "must-support" ? "Must Support" : "Warning" })),
    ...c.notices.map((message) => ({ source: "profile" as const, path: "", message, level: "Note" })),
  ];
  return (
    <>
      <tr className="border-b border-slate-100 align-top hover:bg-slate-50">
        <td className="px-4 py-2.5">
          <Link to={`/organization/${org.id}`} className="hover:underline">{org.name ?? `(unnamed) ${org.id}`}</Link>
        </td>
        <td className="px-4 py-2.5"><ProfileBadge role={roleOf(org)} /></td>
        <td className={`px-4 py-2.5 text-right font-mono ${c.errors.length ? "font-semibold text-red-700" : "text-slate-400"}`}>{c.errors.length}</td>
        <td className={`px-4 py-2.5 text-right font-mono ${ms ? "text-amber-800" : "text-slate-400"}`}>{ms}</td>
        <td className="px-4 py-2.5 text-right font-mono text-slate-500">{other}</td>
        <td className="px-4 py-2.5">
          {c.passes ? <CheckChip result="pass" /> : <CheckChip result="fail" />}
        </td>
        <td className="px-4 py-2.5 text-right">
          {issues.length > 0 && (
            <button type="button" className="text-xs text-slate-500 hover:text-slate-900" aria-expanded={expanded} onClick={onToggle}>
              {expanded ? "Hide" : "Details"}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={7} className="px-4 py-3">
            <ul className="space-y-1.5">
              {issues.map((i, n) => (
                <li key={n} className="text-xs">
                  <span className={`font-medium ${i.level === "Error" ? "text-red-700" : i.level === "Must Support" ? "text-amber-800" : "text-slate-600"}`}>{i.level}</span>{" "}
                  <span className="font-mono text-slate-500">{i.path}</span>{" "}
                  <span className="text-slate-700">{i.message}</span>
                </li>
              ))}
            </ul>
            <Link to={`/organization/${org.id}/edit`} className="mt-2 inline-block text-xs underline">Edit this entry</Link>
          </td>
        </tr>
      )}
    </>
  );
}
