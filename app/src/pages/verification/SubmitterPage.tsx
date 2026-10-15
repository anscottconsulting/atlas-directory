import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAllOrganizations } from "../../hooks/useOrganizations";
import { roleOf } from "../../lib/rce-profiles";
import { evaluate, npiOf } from "../../lib/verification/rules";
import { checkAllConformance } from "../../lib/verification/conformance";
import { einOf, verifyAll, type IdentityCheck, type IdentityResult } from "../../lib/verification/identity";
import { usePreviewSubmitter } from "../../lib/verification/submitters";
import { CheckChip, LiveBadge } from "../../components/verification/StatusChip";
import ErrorBanner from "../../components/ErrorBanner";
import Spinner from "../../components/Spinner";
import StatCard from "../../components/StatCard";

/** Days a submitter has to answer, counted from the entry's last update. */
const ANSWER_WINDOW_DAYS = 30;

interface Item {
  org: fhir4.Organization;
  result: IdentityResult;
  asks: IdentityCheck[];
  dueDays: number;
}

/**
 * What a submitter sees for Level 2: their entries that passed Level 1, run
 * through the identity checks (NPPES, EIN, directory rules). Questions and
 * evidence requests come back to the submitter; entries that can't be
 * verified go to staff review.
 */
export default function SubmitterPage() {
  const q = useAllOrganizations();
  const orgs = useMemo(() => q.data ?? [], [q.data]);
  const { submitters, submitter, entries, setSubmitterId } = usePreviewSubmitter(orgs, "QHIN Beta");
  const [selectedId, setSelectedId] = useState("");
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  const versionKey = entries.map((o) => `${o.id}@${o.meta?.versionId ?? ""}`).join(",");
  const level1 = useQuery({
    queryKey: ["conformance", versionKey],
    enabled: entries.length > 0,
    staleTime: Infinity,
    queryFn: () => checkAllConformance(entries),
  });
  const passed = useMemo(() => entries.filter((o) => level1.data?.get(o.id!)?.passes), [entries, level1.data]);
  // Directory rules need the whole directory (uniqueness, parents).
  const rules = useMemo(() => new Map(evaluate(orgs).map((r) => [r.org.id!, r])), [orgs]);
  const level2 = useQuery({
    queryKey: ["identity", versionKey, passed.map((o) => o.id).join(",")],
    enabled: passed.length > 0,
    staleTime: Infinity,
    queryFn: () => verifyAll(passed.map((org) => ({ org, rules: rules.get(org.id!)! }))),
  });

  if (q.isLoading) return <Spinner label="Loading your entries..." />;
  if (q.isError) return <ErrorBanner title="Couldn't reach the FHIR server" error={q.error} />;

  const results = level2.data;
  const items: Item[] = results
    ? passed
        .map((org) => {
          const result = results.get(org.id!)!;
          return { org, result, asks: result.checks.filter((c) => c.result === "question" || c.result === "evidence"), dueDays: dueDays(org) };
        })
        .filter((it) => it.result.status !== "unable" && it.asks.length > 0)
        .sort((a, b) => a.dueDays - b.dueDays)
    : [];
  const underReview = results ? passed.filter((o) => results.get(o.id!)!.status === "unable") : [];
  const verified = results ? passed.filter((o) => results.get(o.id!)!.status === "verified") : [];
  const clarifications = items.filter((it) => it.asks.some((c) => c.result === "question")).length;
  const evidenceOnly = items.length - clarifications;
  const item = items.find((it) => it.org.id === selectedId) ?? items[0];
  const level1Failing = level1.data ? entries.length - passed.length : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          {submitters.length > 0 && (
            <>
              <label htmlFor="as-submitter-2">Previewing as</label>
              <select
                id="as-submitter-2"
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
        <h1 className="text-2xl font-semibold">Level 2 validation</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Entries that pass Level 1 are checked against outside sources: the NPPES NPI Registry for the NPI, name and location, and IRS
          rules for the EIN. Where something doesn't line up we ask you; where only a document can confirm it, we ask for evidence.
          Nothing changes on the connection while a question is open.
        </p>
      </header>

      {submitters.length === 0 ? (
        <div className="card p-5 text-sm text-slate-600">
          No organizations on the server to preview as. Seed sample data from the <Link to="/" className="underline">Dashboard</Link>.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Passed Level 1"
              value={level1.data ? passed.length : "…"}
              sub={level1.data ? `of ${entries.length} submitted · ${level1Failing} need Level 1 fixes` : undefined}
            />
            <StatCard
              label="Verified"
              value={results ? verified.length : "…"}
              sub={results ? `${verified.filter((o) => results.get(o.id!)!.evidenceNeeded).length} still need evidence` : undefined}
              accent="#047857"
            />
            <StatCard
              label="Need your answer"
              value={results ? items.length : "…"}
              sub={results ? `${clarifications} clarifications · ${evidenceOnly} evidence` : undefined}
              accent="#b88a00"
            />
            <StatCard label="Under review" value={results ? underReview.length : "…"} sub="With our team" accent="#b91c1c" />
          </div>

          {level1.isError && <ErrorBanner title="Level 1 validation failed" error={level1.error} />}
          {level2.isError && <ErrorBanner title="Identity checks failed" error={level2.error} />}
          {(level1.isLoading || level2.isLoading) && <Spinner label="Checking your entries against NPPES and IRS rules..." />}

          {level1.data && passed.length === 0 && (
            <div className="card p-5 text-sm text-slate-600">
              None of these entries pass Level 1 yet, so nothing has reached identity checks. See{" "}
              <Link to="/verify/submitter-level-1" className="underline">Submitter Level 1 Validation</Link>.
            </div>
          )}

          {results && passed.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-3">
              <section className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-semibold">Need your answer</h2>
                  <span className="text-xs text-slate-500">Soonest due first</span>
                </div>
                {items.length === 0 && <p className="text-sm text-slate-500">Nothing needs an answer from you.</p>}
                {items.map((it) => (
                  <button
                    key={it.org.id}
                    type="button"
                    aria-pressed={it === item}
                    onClick={() => setSelectedId(it.org.id!)}
                    className={`card block w-full space-y-1 p-4 text-left hover:bg-slate-50 ${it === item ? "ring-2 ring-slate-900" : ""}`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-semibold">{it.org.name}</span>
                      {submittedIds.has(it.org.id!) ? (
                        <span className="whitespace-nowrap text-xs font-medium text-emerald-700">Submitted</span>
                      ) : (
                        <span className={`whitespace-nowrap text-xs ${it.dueDays <= 5 ? "font-medium text-red-700" : "text-slate-500"}`}>
                          {it.dueDays < 0 ? `Overdue by ${-it.dueDays} days` : `Due in ${it.dueDays} days`}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-slate-500">{roleOf(it.org)}</div>
                    <p className="text-sm text-slate-600">
                      {it.asks[0].name}: {it.asks[0].detail}
                      {it.asks.length > 1 && <span className="text-slate-400"> · +{it.asks.length - 1} more</span>}
                    </p>
                  </button>
                ))}

                {underReview.length > 0 && (
                  <div className="space-y-2 pt-3">
                    <h2 className="font-semibold">Under review</h2>
                    <p className="text-xs text-slate-500">These couldn't be verified. Our team reviews them and will contact you.</p>
                    {underReview.map((o) => {
                      const fail = results.get(o.id!)!.checks.find((c) => c.result === "fail");
                      return (
                        <div key={o.id} className="card space-y-1 p-4">
                          <div className="text-sm font-semibold">{o.name}</div>
                          <p className="text-sm text-slate-600">{fail?.name}: {fail?.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="card space-y-5 p-6 lg:col-span-2">
                {item ? (
                  <ItemForm
                    key={item.org.id}
                    item={item}
                    submitter={submitter?.name ?? ""}
                    submitted={submittedIds.has(item.org.id!)}
                    onSubmittedChange={(done) =>
                      setSubmittedIds((prev) => {
                        const next = new Set(prev);
                        if (done) next.add(item.org.id!);
                        else next.delete(item.org.id!);
                        return next;
                      })
                    }
                  />
                ) : (
                  <p className="text-sm text-slate-600">All your entries that passed Level 1 are verified or with our team.</p>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function dueDays(org: fhir4.Organization): number {
  const from = org.meta?.lastUpdated ? new Date(org.meta.lastUpdated) : new Date();
  const due = from.getTime() + ANSWER_WINDOW_DAYS * 86_400_000;
  return Math.ceil((due - Date.now()) / 86_400_000);
}

/** Form for one item. Keyed by entry id, so switching items starts fresh. */
function ItemForm({
  item,
  submitter,
  submitted,
  onSubmittedChange,
}: {
  item: Item;
  submitter: string;
  submitted: boolean;
  onSubmittedChange: (done: boolean) => void;
}) {
  const { org, asks } = item;
  const address = org.address?.[0];
  const [form, setForm] = useState({
    name: org.name ?? "",
    npi: npiOf(org) ?? "",
    ein: einOf(org) ?? "",
    address: address?.text ?? [address?.line?.join(" "), address?.city, address?.state, address?.postalCode].filter(Boolean).join(", "),
  });
  const questions = asks.filter((c) => c.result === "question");
  const evidence = asks.filter((c) => c.result === "evidence");
  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => 0));
  const [notes, setNotes] = useState<string[]>(() => questions.map(() => ""));
  const [files, setFiles] = useState<string[]>([]);
  const [attested, setAttested] = useState(false);
  const due = new Date(Date.now() + item.dueDays * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const evidenceMissing = evidence.length > 0 && files.length === 0;

  if (submitted) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Submitted for review</h2>
        <p className="text-sm text-slate-600">
          {form.name} is back in the verification queue. We rerun the checks and you'll get a notice when they finish.
        </p>
        <button type="button" className="btn-secondary" onClick={() => onSubmittedChange(false)}>Back to the form</button>
      </div>
    );
  }

  let step = 1;
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmittedChange(true);
      }}
    >
      <div>
        <div className="font-mono text-xs text-slate-500">Organization/{org.id} · due {due}</div>
        <h2 className="text-xl font-semibold">{org.name}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          This entry passed Level 1. When we checked it against the NPPES registry and IRS rules,{" "}
          {questions.length > 0 && `${questions.length} thing${questions.length === 1 ? "" : "s"} didn't line up`}
          {questions.length > 0 && evidence.length > 0 && " and "}
          {evidence.length > 0 && "one needs a document to confirm"}. Nothing changes on the connection while this is open.
        </p>
      </div>

      <fieldset className="space-y-3 rounded-lg p-4 ring-1 ring-slate-200">
        <legend className="px-1 text-sm font-semibold">{step++}. Check what we have on file</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="s-name" className="label">Organization name</label>
            <input id="s-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="s-npi" className="label">NPI</label>
            <input id="s-npi" className="input font-mono" value={form.npi} onChange={(e) => setForm({ ...form, npi: e.target.value })} />
          </div>
          <div>
            <label htmlFor="s-ein" className="label">EIN</label>
            <input id="s-ein" className="input font-mono" placeholder="NN-NNNNNNN" value={form.ein} onChange={(e) => setForm({ ...form, ein: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="s-addr" className="label">Address</label>
            <input id="s-addr" className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-slate-500">Changes here update the same record. We rerun the checks when you submit.</p>
      </fieldset>

      {questions.length > 0 && (
        <fieldset className="space-y-4 rounded-lg p-4 ring-1 ring-slate-200">
          <legend className="px-1 text-sm font-semibold">{step++}. Answer our questions</legend>
          {questions.map((c, i) => (
            <div key={c.name + i} className="space-y-2 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
              <div className="flex gap-2 text-sm">
                <CheckChip result="question" />
                <span><span className="font-medium">{c.name}:</span> {c.detail}</span>
              </div>
              {["I've corrected it above", "It's correct as it is"].map((label, j) => (
                <label key={label} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`answer-${i}`}
                    checked={answers[i] === j}
                    onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))}
                  />
                  {label}
                </label>
              ))}
              {answers[i] === 1 && (
                <textarea
                  aria-label={`Why the ${c.name} is correct`}
                  rows={2}
                  className="input"
                  placeholder="Tell us why, e.g. the NPPES record is out of date"
                  value={notes[i]}
                  onChange={(e) => setNotes((n) => n.map((x, k) => (k === i ? e.target.value : x)))}
                />
              )}
            </div>
          ))}
        </fieldset>
      )}

      <fieldset className="space-y-2 rounded-lg p-4 ring-1 ring-slate-200">
        <legend className="px-1 text-sm font-semibold">
          {step++}. Attach evidence{evidence.length === 0 && " (optional)"}
        </legend>
        {evidence.map((c) => (
          <div key={c.name} className="flex gap-2 text-sm">
            <CheckChip result="evidence" />
            <span><span className="font-medium">{c.name}:</span> {c.detail}</span>
          </div>
        ))}
        <label
          htmlFor="s-files"
          className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:bg-slate-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="text-slate-600">
            <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" />
          </svg>
          <span className="text-sm">Choose files</span>
          <span className="text-xs text-slate-500">PDF or image. Stored on [secure file host], visible to directory staff and your organization only.</span>
        </label>
        <input
          id="s-files"
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))}
        />
        {files.length > 0 && (
          <ul className="text-sm text-slate-700">
            {files.map((f) => <li key={f}>{f}</li>)}
          </ul>
        )}
        <p className="text-xs text-slate-500">Files stay in your browser in this sandbox. Nothing is uploaded.</p>
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
        I confirm this information is accurate and I'm authorized to submit it for {submitter}.
      </label>
      <div className="flex items-center justify-end gap-3">
        {evidenceMissing && <span className="text-xs text-slate-500">Attach the requested document to submit</span>}
        <button type="button" className="btn-secondary">Save draft</button>
        <button type="submit" className="btn-primary" disabled={!attested || evidenceMissing}>Submit for review</button>
      </div>
    </form>
  );
}
