import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAllOrganizations } from "../../hooks/useOrganizations";
import { roleOf } from "../../lib/rce-profiles";
import { evaluate, FIELD_RULES } from "../../lib/verification/rules";
import ProfileBadge from "../../components/ProfileBadge";
import ErrorBanner from "../../components/ErrorBanner";
import Spinner from "../../components/Spinner";
import StatCard from "../../components/StatCard";
import { LiveBadge } from "../../components/verification/StatusChip";

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

  const results = useMemo(() => evaluate(q.data ?? []), [q.data]);

  if (q.isLoading) return <Spinner label="Checking directory entries..." />;
  if (q.isError) return <ErrorBanner title="Couldn't reach the FHIR server" error={q.error} />;

  const ready = results.filter((r) => r.vettingReady).length;
  const needsFix = results.length - ready;
  const clean = results.filter((r) => r.failures.length === 0).length;
  const failingByRule = new Map(FIELD_RULES.map((rule) => [rule.id, results.filter((r) => r.failures.some((f) => f.rule.id === rule.id))]));

  const listed = results
    .filter((r) => r.failures.length > 0)
    .filter((r) => !ruleFilter || r.failures.some((f) => f.rule.id === ruleFilter));

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1"><LiveBadge /></div>
        <h1 className="text-2xl font-semibold">Data quality and verification waves</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Field rules run against every organization on the server. Entries that pass all vetting rules can go straight to identity
          verification (wave 1). The rest get one correction list, and go in wave 2 once fixed.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Organizations checked" value={results.length} />
        <StatCard label="Wave 1 · ready" value={ready} sub="All vetting rules pass" accent="#047857" />
        <StatCard label="Needs correction" value={needsFix} sub="At least one vetting rule fails" accent="#b45309" />
        <StatCard label="Fully clean" value={clean} sub="Every rule passes" />
      </div>

      {results.length === 0 && (
        <div className="card p-5 text-sm text-slate-600">
          No organizations on the server yet. Seed sample data from the <Link to="/" className="underline">Dashboard</Link>.
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3">
          <h2 className="font-semibold">Field rules</h2>
          <span className="text-xs text-slate-500">Click a rule to see the entries failing it. Rules live in src/lib/verification/rules.ts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-4 py-2 font-medium">Field</th>
                <th className="px-4 py-2 font-medium">Format</th>
                <th className="px-4 py-2 font-medium">Cardinality</th>
                <th className="px-4 py-2 font-medium">Rule</th>
                <th className="px-4 py-2 font-medium">Vetting</th>
                <th className="px-4 py-2 text-right font-medium">Failing</th>
                <th className="px-4 py-2 font-medium">Fix window</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_RULES.map((rule) => {
                const failing = failingByRule.get(rule.id)?.length ?? 0;
                const active = ruleFilter === rule.id;
                return (
                  <tr key={rule.id} className={`border-b border-slate-100 ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}>
                    <td className="px-4 py-2 font-medium">
                      <button type="button" className="text-left hover:underline" onClick={() => setRuleFilter(active ? "" : rule.id)} aria-pressed={active}>
                        {rule.field}
                      </button>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{rule.format}</td>
                    <td className="px-4 py-2 font-mono text-xs">{rule.cardinality}</td>
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

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3">
          <h2 className="font-semibold">
            Correction list{ruleFilter && `: ${FIELD_RULES.find((r) => r.id === ruleFilter)?.field}`}
          </h2>
          {ruleFilter && (
            <button type="button" className="text-sm text-slate-600 underline" onClick={() => setRuleFilter("")}>Show all rules</button>
          )}
        </div>
        {listed.length === 0 ? (
          <div className="px-5 pb-5 text-sm text-slate-500">Nothing to correct.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-4 py-2 font-medium">Organization</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Problems</th>
                  <th className="px-4 py-2 font-medium">Wave</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {listed.map((r) => (
                  <tr key={r.org.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link to={`/organization/${r.org.id}`} className="hover:underline">{r.org.name ?? `(unnamed) ${r.org.id}`}</Link>
                    </td>
                    <td className="px-4 py-2.5"><ProfileBadge role={roleOf(r.org)} /></td>
                    <td className="px-4 py-2.5">
                      <ul className="space-y-0.5">
                        {r.failures.map((f) => (
                          <li key={f.rule.id} className="text-xs">
                            <span className="font-medium">{f.rule.field}:</span>{" "}
                            <span className="text-slate-600">{f.message}</span>
                            {!f.rule.vetting && <span className="text-slate-400"> (not vetting)</span>}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{r.vettingReady ? "Wave 1" : "After correction"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link to={`/organization/${r.org.id}/edit`} className="text-xs text-slate-500 hover:text-slate-900">Fix</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
