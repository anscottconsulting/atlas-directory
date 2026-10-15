import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SampleBadge } from "../../components/verification/StatusChip";
import { ISSUES } from "../../lib/verification/sample";
import type { IssueStep } from "../../lib/verification/types";

const STEP_LABEL: Record<IssueStep, string> = {
  review: "Review",
  clarification: "Waiting on submitter",
  recheck: "Recheck",
  closed: "Closed",
  policy: "Policy review",
};

export function IssuesListPage() {
  return (
    <div className="space-y-4">
      <header>
        <div className="mb-1"><SampleBadge /></div>
        <h1 className="text-2xl font-semibold">Issues</h1>
        <p className="text-sm text-slate-500">
          Every exception keeps its record ID, evidence, owner and next action until it's closed. Unresolved stays explicit.
        </p>
      </header>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-slate-600">
              <th className="px-4 py-2 font-medium">Issue</th>
              <th className="px-4 py-2 font-medium">Question</th>
              <th className="px-4 py-2 font-medium">Submitter</th>
              <th className="px-4 py-2 font-medium">Step</th>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 font-medium">Next action</th>
            </tr>
          </thead>
          <tbody>
            {ISSUES.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link to={`/verify/issues/${i.id}`} className="font-mono text-xs underline">{i.id}</Link>
                </td>
                <td className="px-4 py-2.5 font-medium">{i.title}</td>
                <td className="px-4 py-2.5 text-slate-600">{i.submitter}</td>
                <td className="px-4 py-2.5">{STEP_LABEL[i.step]}</td>
                <td className="px-4 py-2.5 text-slate-600">{i.owner}</td>
                <td className="px-4 py-2.5 text-slate-600">{i.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const STEPS: { key: IssueStep; title: string; hint: string }[] = [
  { key: "review", title: "1. Review the issue", hint: "Partial: one specific question. Unable: manual review with reason." },
  { key: "clarification", title: "2. Clarification", hint: "Confirm or correct name, NPI, address or entry type. Request supporting evidence." },
  { key: "recheck", title: "3. Recheck the entry", hint: "Same record ID, rerun matching and checks." },
  { key: "closed", title: "4. Close out", hint: "Share the result and document the resolution." },
];

export function IssueDetailPage() {
  const { id } = useParams();
  const issue = ISSUES.find((i) => i.id === id);
  const [step, setStep] = useState<IssueStep>(issue?.step ?? "review");
  // The step an issue was on when it went to policy review, so the tracker
  // keeps showing where it stopped and it can go back there.
  const [escalatedFrom, setEscalatedFrom] = useState<IssueStep>(issue?.step === "policy" ? "recheck" : issue?.step ?? "review");
  const [rerunDone, setRerunDone] = useState(false);
  const [owner, setOwner] = useState(issue?.owner ?? "Unassigned");
  const [failNotice, setFailNotice] = useState<"call" | "written">("call");
  const [reply, setReply] = useState("");

  if (!issue) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">No sample issue with ID {id}.</p>
        <Link to="/verify/issues" className="text-sm underline">Back to issues</Link>
      </div>
    );
  }

  const inPolicy = step === "policy";
  const currentIndex = STEPS.findIndex((s) => s.key === (inPolicy ? escalatedFrom : step));
  const goTo = (next: IssueStep) => {
    if (next === "policy") setEscalatedFrom(step);
    setRerunDone(false);
    setStep(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/verify/issues" className="hover:underline">Issues</Link> / <span className="font-mono">{issue.id}</span> <SampleBadge />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{issue.title}</h1>
          <p className="text-sm text-slate-500">
            Record <Link to={`/verify/entry/${issue.entryId}`} className="font-mono underline">{issue.entryId}</Link> · {issue.org} · {issue.submitter}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {step === "clarification" && (
            <button type="button" className="btn-secondary" onClick={() => goTo("recheck")}>Move to recheck</button>
          )}
          {step !== "policy" && step !== "closed" && (
            <button type="button" className="btn-secondary" onClick={() => goTo("policy")}>Send to policy review</button>
          )}
        </div>
      </header>

      {inPolicy && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm">
          <span className="font-semibold">In manual / policy review.</span> Sent from "{STEPS[currentIndex].title}". The issue stays open
          with its evidence until a rule is set.{" "}
          <button type="button" className="underline" onClick={() => setStep(escalatedFrom)}>
            Return to {STEPS[currentIndex].title.replace(/^\d+\. /, "").toLowerCase()}
          </button>
        </div>
      )}

      <ol aria-label="Resolution steps" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => {
          const done = i < currentIndex || step === "closed";
          const current = i === currentIndex && step !== "closed";
          const label = done ? "Done" : current ? (inPolicy ? "Paused · in policy review" : "Current") : "Next";
          return (
            <li
              key={s.key}
              aria-current={current ? "step" : undefined}
              className={`rounded-lg p-3.5 ${
                current
                  ? inPolicy
                    ? "bg-white ring-2 ring-amber-500"
                    : "bg-white ring-2 ring-slate-900"
                  : done
                    ? "bg-white ring-1 ring-slate-200"
                    : "border border-dashed border-slate-300"
              }`}
            >
              <div className={`text-xs font-medium ${done ? "text-emerald-700" : current ? (inPolicy ? "text-amber-700" : "text-slate-900") : "text-slate-400"}`}>
                {label}
              </div>
              <div className="text-sm font-semibold">{s.title}</div>
              <div className="text-xs text-slate-500">{s.hint}</div>
            </li>
          );
        })}
      </ol>

      {step === "recheck" && (
        <section className="card space-y-3 p-5">
          {!rerunDone ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">Apply the proposed correction to the same record ID, then rerun matching and the supporting checks.</p>
              <button type="button" className="btn-primary" onClick={() => setRerunDone(true)}>Apply correction and rerun</button>
            </div>
          ) : (
            <>
              <div>
                <h2 className="font-semibold">Issue resolved?</h2>
                <p className="text-sm text-slate-600">Rerun finished. Review the new matching result and evidence, then decide.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => goTo("closed")}>Yes, close out</button>
                <button type="button" className="btn-secondary" onClick={() => goTo("clarification")}>More evidence needed</button>
                <button type="button" className="btn-secondary" onClick={() => goTo("policy")}>No, send to manual / policy review</button>
              </div>
            </>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">Conversation with submitter</h2>
            {issue.messages.length === 0 && <p className="text-sm text-slate-500">Nothing sent yet.</p>}
            {issue.messages.map((m, i) => (
              <article key={i} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
                <div className="text-xs text-slate-500">{m.author} · {m.from === "verifier" ? "sent" : "replied"} {m.at}</div>
                <p className="text-sm leading-relaxed">{m.body}</p>
                {m.attachment && (
                  <div className="flex max-w-sm items-center gap-2 rounded-md px-3 py-2 text-sm ring-1 ring-slate-200">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="text-slate-500">
                      <path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" />
                    </svg>
                    <span className="flex-1">{m.attachment}</span>
                    <button type="button" className="text-xs underline">View</button>
                  </div>
                )}
              </article>
            ))}
            <div>
              <label htmlFor="reply" className="label">Reply</label>
              <textarea id="reply" rows={3} className="input" placeholder="Ask a follow-up or confirm next steps" value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="mt-2 flex justify-end">
                <button type="button" className="btn-secondary" disabled={!reply.trim()} onClick={() => setReply("")}>Send reply</button>
              </div>
            </div>
          </section>

          {issue.correction.length > 0 && (
            <section className="card space-y-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">Proposed correction to the same record</h2>
                <span className="text-xs text-slate-500">Written to the directory only after the rerun passes</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="py-2 pr-3 font-medium">Field</th>
                      <th className="py-2 pr-3 font-medium">Current</th>
                      <th className="py-2 font-medium">After correction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issue.correction.map((c) => (
                      <tr key={c.field} className={`border-b border-slate-100 ${c.changed ? "bg-slate-50" : ""}`}>
                        <td className="py-2 pr-3">{c.field}</td>
                        <td className="py-2 pr-3 text-slate-600">{c.current}</td>
                        <td className="py-2">{step === "closed" && c.field === "Status" ? "Verified" : c.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Issue</h2>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-slate-500">Status</dt><dd>{step === "closed" ? "Closed" : `Open · ${STEP_LABEL[step].toLowerCase()}`}</dd></div>
              <div>
                <dt className="text-xs text-slate-500"><label htmlFor="owner">Owner</label></dt>
                <dd>
                  <select id="owner" className="input mt-1" value={owner} onChange={(e) => setOwner(e.target.value)}>
                    <option>J. Alvarez</option>
                    <option>K. Osei</option>
                    <option>Unassigned</option>
                  </select>
                </dd>
              </div>
              <div><dt className="text-xs text-slate-500">Next action</dt><dd>{step === "closed" ? "None" : issue.nextAction}</dd></div>
              <div><dt className="text-xs text-slate-500">Due</dt><dd>{issue.due}</dd></div>
            </dl>
          </section>

          {issue.policyQuestion && (
            <section className="card space-y-2 p-5">
              <h2 className="font-semibold">Policy question this raises</h2>
              <p className="text-sm leading-relaxed text-slate-700">{issue.policyQuestion.text}</p>
              <p className="text-xs text-slate-500">{issue.policyQuestion.similarOpen} other open issues have the same pattern</p>
            </section>
          )}

          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">How the result goes out</h2>
            <fieldset className="space-y-1.5">
              <legend className="text-xs text-slate-500">If it passes</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked readOnly />Automated notice and directory flag</label>
            </fieldset>
            <fieldset className="space-y-1.5">
              <legend className="text-xs text-slate-500">If it fails (connection will be deactivated)</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="fail" checked={failNotice === "call"} onChange={() => setFailNotice("call")} />
                Account manager call, then written notice
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="fail" checked={failNotice === "written"} onChange={() => setFailNotice("written")} />
                Written notice only
              </label>
            </fieldset>
          </section>
        </aside>
      </div>
    </div>
  );
}
