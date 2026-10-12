import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckChip, SampleBadge, StatusChip } from "../../components/verification/StatusChip";
import { ENTRY_DETAILS, ISSUES, QUEUE } from "../../lib/verification/sample";

export default function EntryPage() {
  const { id } = useParams();
  const row = QUEUE.find((e) => e.id === id);
  const detail = id ? ENTRY_DETAILS[id] : undefined;
  const issue = ISSUES.find((i) => i.entryId === id);
  const [question, setQuestion] = useState(detail?.suggestedQuestion ?? "");

  if (!row) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">No sample entry with ID {id}.</p>
        <Link to="/verify/queue" className="text-sm underline">Back to queue</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/verify/queue" className="hover:underline">Queue</Link> / <span className="font-mono">{row.id}</span> <SampleBadge />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{row.org}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusChip status={row.status} />
            {detail && <Tag>Top-level · {detail.delegates} entries below</Tag>}
            <Tag>{row.entryType}</Tag>
            <Tag>Requested purpose: Treatment</Tag>
            <span className="text-slate-500">Submitter: {row.submitter}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary">Route to manual review</button>
          <button type="button" className="btn-secondary">Accept as verified</button>
          <Link to={issue ? `/verify/issues/${issue.id}` : "/verify/issues"} className="btn-primary">
            {issue ? "Open issue" : "Request clarification"}
          </Link>
        </div>
      </header>

      {!detail ? (
        <div className="card p-5 text-sm text-slate-600">
          <p className="mb-1 font-medium text-slate-800">{row.reason}</p>
          <p>
            Full match evidence is only mocked for{" "}
            <Link to="/verify/entry/VR-0004187" className="underline">VR-0004187</Link>. Add more to{" "}
            <code className="font-mono text-xs">ENTRY_DETAILS</code> in sample.ts.
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
            <h2 className="font-semibold">{detail.headline}</h2>
            <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-700">{detail.explanation}</p>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Directory entry as submitted</h2>
              <dl className="space-y-3 text-sm">
                <Def label="Organization name">{detail.submitted.name}</Def>
                <Def label="Supplied NPI"><span className="font-mono">{detail.submitted.npi}</span></Def>
                <Def label="Address">{detail.submitted.address.map((l) => <div key={l}>{l}</div>)}</Def>
                <Def label="Home community OID"><span className="break-all font-mono text-xs">{detail.submitted.oid}</span></Def>
                <Def label="Endpoint"><span className="break-all font-mono text-xs">{detail.submitted.endpoint}</span></Def>
                <Def label="Managing organization">{detail.submitted.managingOrg}</Def>
              </dl>
            </section>

            <section className="card space-y-4 p-5 lg:col-span-2">
              <h2 className="font-semibold">Candidates compared</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="py-2 pr-3 font-medium">Candidate</th>
                      <th className="py-2 pr-3 font-medium">NPI</th>
                      <th className="py-2 pr-3 font-medium">Name</th>
                      <th className="py-2 pr-3 font-medium">Address</th>
                      <th className="py-2 pr-3 font-medium">Billing activity</th>
                      <th className="py-2 pr-3 font-medium">Score</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.candidates.map((c) => (
                      <tr key={c.npi} className={`border-b border-slate-100 align-top ${c.disposition === "selected" ? "bg-slate-50" : ""}`}>
                        <td className="py-2.5 pr-3">
                          <div className={c.disposition === "selected" ? "font-semibold" : "font-medium"}>{c.name}</div>
                          <div className="text-xs text-slate-500">{c.kind}</div>
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs">{c.npi}</td>
                        <td className="py-2.5 pr-3">{c.nameMatch}</td>
                        <td className="py-2.5 pr-3">{c.addressMatch}</td>
                        <td className="py-2.5 pr-3">{c.activity}</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">{c.confidence} · {c.score}</td>
                        <td className="py-2.5 text-xs">
                          {c.disposition === "selected" && <span className="font-semibold text-slate-900">Selected</span>}
                          {c.disposition === "kept" && <span className="text-slate-500">Kept as supplied ID</span>}
                          {c.disposition === "rejected" && <span className="text-slate-400">Rejected</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="mb-1 text-sm font-semibold">How the match got here</h3>
                <ol>
                  {detail.passes.map((p) => (
                    <li key={p.pass} className="flex gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
                      <span className="w-14 flex-none text-slate-500">Pass {p.pass}</span>
                      <span className="flex-1">{p.description}</span>
                      <span className={p.outcome === "match" ? "font-medium text-emerald-700" : "text-slate-500"}>{p.outcome}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <section className="card p-5 lg:col-span-3">
              <h2 className="mb-2 font-semibold">Supporting checks</h2>
              {detail.checks.map((c) => (
                <div key={c.name} className="flex items-start gap-3 border-b border-slate-100 py-2.5 last:border-0">
                  <span className="w-20 flex-none"><CheckChip result={c.result} /></span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.detail}</div>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-500">{c.source}</span>
                </div>
              ))}
            </section>

            <div className="space-y-4 lg:col-span-2">
              <section className="card space-y-3 p-5">
                <h2 className="font-semibold">Suggested question for the submitter</h2>
                <label htmlFor="question" className="label">Edit before sending</label>
                <textarea id="question" rows={6} className="input leading-relaxed" value={question} onChange={(e) => setQuestion(e.target.value)} />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Due in 15 business days</span>
                  <Link to={issue ? `/verify/issues/${issue.id}` : "/verify/issues"} className="btn-primary">Open issue and send</Link>
                </div>
              </section>
              <section className="card p-5">
                <h2 className="mb-2 font-semibold">Record history</h2>
                <ul className="space-y-2 text-sm text-slate-700">
                  {detail.history.map((h) => (
                    <li key={h.at + h.text}><span className="text-slate-500">{h.at}</span> · {h.text}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded px-2 py-0.5 text-slate-600 ring-1 ring-slate-300">{children}</span>;
}

function Def({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
