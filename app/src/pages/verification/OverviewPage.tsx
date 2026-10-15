import { Link } from "react-router-dom";
import StatCard from "../../components/StatCard";
import { SampleBadge } from "../../components/verification/StatusChip";
import { LEVEL1_REASONS, PARTIAL_REASONS, RUN, STAGES, SUBMITTERS } from "../../lib/verification/sample";

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;

export default function OverviewPage() {
  const maxReason = Math.max(...PARTIAL_REASONS.map((r) => r.count));
  const maxLevel1Reason = Math.max(...LEVEL1_REASONS.map((r) => r.count));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
            {RUN.label} <SampleBadge />
          </div>
          <h1 className="text-2xl font-semibold">Validation overview</h1>
          <p className="text-sm text-slate-500">
            Top-level entries only. Entries below them inherit the result of the entry they point to.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary">Export run report</button>
          <button type="button" className="btn-primary">Start a run</button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Passed Level 1" value={fmt(RUN.total)} sub={`of ${fmt(RUN.submitted)} submitted · ${fmt(RUN.level1Failing)} failing`} />
        <StatCard label="Verified" value={fmt(RUN.verified)} sub={`${pct(RUN.verified, RUN.total)} · checks consistent`} accent="#047857" />
        <StatCard label="Partially verified" value={fmt(RUN.partial)} sub={`${pct(RUN.partial, RUN.total)} · conflicting evidence`} accent="#b45309" />
        <StatCard label="Unable to verify" value={fmt(RUN.unable)} sub={`${pct(RUN.unable, RUN.total)} · no supported candidate`} accent="#b91c1c" />
        <StatCard
          label="Waiting on submitters"
          value={fmt(RUN.clarificationsOpen + RUN.evidenceRequests)}
          sub={`${RUN.clarificationsOpen} clarifications · ${RUN.evidenceRequests} evidence`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Level 1 · IG conformance</h2>
            <Link to="/verify/submitter-level-1" className="text-sm text-slate-600 hover:underline">Submitter view</Link>
          </div>
          <p className="text-sm text-slate-500">
            Every submitted entry is validated against the RCE IG profiles. Only entries that pass go on to identity matching.
          </p>
          <div
            role="img"
            aria-label={`${RUN.total} passed Level 1, ${RUN.level1Failing} failing`}
            className="flex h-4 gap-0.5 overflow-hidden rounded"
          >
            <div className="bg-emerald-600" style={{ width: pct(RUN.total, RUN.submitted) }} />
            <div className="bg-red-700" style={{ width: pct(RUN.level1Failing, RUN.submitted) }} />
          </div>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Submitted</dt><dd className="font-mono text-lg">{fmt(RUN.submitted)}</dd></div>
            <div>
              <dt className="text-xs text-slate-500">Passed</dt>
              <dd className="font-mono text-lg text-emerald-700">{fmt(RUN.total)} <span className="text-xs text-slate-500">{pct(RUN.total, RUN.submitted)}</span></dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Failing, back with submitters</dt>
              <dd className="font-mono text-lg text-red-700">{fmt(RUN.level1Failing)} <span className="text-xs text-slate-500">{pct(RUN.level1Failing, RUN.submitted)}</span></dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">
            {fmt(RUN.mustSupportGaps)} entries ({pct(RUN.mustSupportGaps, RUN.submitted)}) have at least one Must Support element empty.
            Those are warnings and don't block Level 2.
          </p>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Why entries fail Level 1</h2>
          {LEVEL1_REASONS.map((r) => (
            <div key={r.label} className="space-y-1.5">
              <div className="flex justify-between gap-3 text-sm">
                <span>{r.label}</span>
                <span className="font-mono">{r.count}</span>
              </div>
              <div className="h-1.5 rounded bg-red-50">
                <div className="h-1.5 rounded bg-red-700" style={{ width: `${(r.count / maxLevel1Reason) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Level 2 · Match result</h2>
          <span className="text-sm text-slate-500">
            Match confidence is one input. Address, activity and entry-type checks decide the status.
          </span>
        </div>
        <div
          role="img"
          aria-label={`${RUN.verified} verified, ${RUN.partial} partially verified, ${RUN.unable} unable to verify`}
          className="flex h-4 gap-0.5 overflow-hidden rounded"
        >
          <div className="bg-emerald-600" style={{ width: pct(RUN.verified, RUN.total) }} />
          <div className="bg-amber-400" style={{ width: pct(RUN.partial, RUN.total) }} />
          <div className="min-w-[4px] bg-red-800" style={{ width: pct(RUN.unable, RUN.total) }} />
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-slate-600">
          <Legend cls="bg-emerald-600" text="Verified: proceed through remaining vetting" />
          <Legend cls="bg-amber-400" text="Partially verified: ask a specific question" />
          <Legend cls="bg-red-800" text="Unable to verify: manual review with reason" />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Why entries are partially verified</h2>
            <Link to="/verify/queue" className="text-sm text-slate-600 hover:underline">Open in queue</Link>
          </div>
          {PARTIAL_REASONS.map((r) => (
            <Link key={r.key} to={`/verify/queue?reason=${r.key}`} className="block space-y-1.5 group">
              <div className="flex justify-between text-sm">
                <span className="group-hover:underline">{r.label}</span>
                <span className="font-mono">{r.count}</span>
              </div>
              <div className="h-1.5 rounded bg-amber-50">
                <div className="h-1.5 rounded bg-amber-400" style={{ width: `${(r.count / maxReason) * 100}%` }} />
              </div>
            </Link>
          ))}
        </section>

        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Where the run is</h2>
          <ol>
            {STAGES.map((s, i) => (
              <li key={s.name} className="flex gap-3 border-b border-slate-100 py-2.5 last:border-0">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.detail}</div>
                </div>
                <span className="whitespace-nowrap text-sm text-slate-600">{s.state}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="card overflow-hidden">
        <h2 className="px-5 pt-5 pb-3 font-semibold">By submitter</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-4 py-2 font-medium">Submitter</th>
                <th className="px-4 py-2 text-right font-medium">Submitted</th>
                <th className="px-4 py-2 text-right font-medium">Failing L1</th>
                <th className="px-4 py-2 text-right font-medium">Passed L1</th>
                <th className="px-4 py-2 text-right font-medium">Verified</th>
                <th className="px-4 py-2 text-right font-medium">Partial</th>
                <th className="px-4 py-2 text-right font-medium">Unable</th>
                <th className="px-4 py-2 text-right font-medium">Clarifications</th>
                <th className="px-4 py-2 text-right font-medium">Evidence requests</th>
                <th className="px-4 py-2 font-medium">Oldest open</th>
              </tr>
            </thead>
            <tbody>
              {SUBMITTERS.map((s) => (
                <tr key={s.name} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link to={`/verify/queue?submitter=${encodeURIComponent(s.name)}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(s.submitted)}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-700">{s.level1Failing}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(s.total)}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {fmt(s.verified)} <span className="text-slate-400">({pct(s.verified, s.total)})</span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{s.partial}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.unable}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.clarifications}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.evidence}</td>
                  <td className="px-4 py-2 text-slate-600">{s.oldest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Legend({ cls, text }: { cls: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${cls}`} />
      {text}
    </span>
  );
}
