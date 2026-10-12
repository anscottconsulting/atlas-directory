import { useState } from "react";
import { SampleBadge } from "../../components/verification/StatusChip";
import StatCard from "../../components/StatCard";
import { SUBMITTER_VIEW as S } from "../../lib/verification/sample";

/**
 * What a submitting organization would see: only its own entries, the
 * questions waiting on it, and a form to confirm fields and attach evidence.
 */
export default function SubmitterPage() {
  const [form, setForm] = useState(S.form);
  const [status, setStatus] = useState<"ce" | "non-ce">("ce");
  const [files, setFiles] = useState<string[]>([]);
  const [attested, setAttested] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
            Previewing as {S.submitter} <SampleBadge />
          </div>
          <h1 className="text-2xl font-semibold">Your entries</h1>
          <p className="text-sm text-slate-500">You only see top-level entries you manage. Verified entries need nothing from you.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Top-level entries" value={S.total} />
        <StatCard label="Verified" value={S.verified} accent="#047857" />
        <StatCard label="Need your answer" value={S.needAnswer} accent="#0f172a" />
        <StatCard label="Under review" value={S.underReview} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Need your answer</h2>
            <span className="text-xs text-slate-500">Soonest due first</span>
          </div>
          {S.items.map((it) => (
            <article key={it.id} className={`card space-y-1 p-4 ${it.id === form.id ? "ring-2 ring-slate-900" : ""}`}>
              <div className="flex justify-between gap-2">
                <span className="text-sm font-semibold">{it.org}</span>
                <span className={`whitespace-nowrap text-xs ${it.dueDays <= 5 ? "font-medium text-red-700" : "text-slate-500"}`}>
                  Due in {it.dueDays} days
                </span>
              </div>
              <div className="font-mono text-xs text-slate-500">{it.id}</div>
              <p className="text-sm text-slate-600">{it.ask}</p>
            </article>
          ))}
        </section>

        <section className="card space-y-5 p-6 lg:col-span-2">
          {submitted ? (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Submitted for review</h2>
              <p className="text-sm text-slate-600">
                {form.name} ({form.id}) is back in the verification queue. You'll get a notice when the recheck finishes.
              </p>
              <button type="button" className="btn-secondary" onClick={() => setSubmitted(false)}>Back to the form</button>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
            >
              <div>
                <div className="font-mono text-xs text-slate-500">{form.id} · due [date]</div>
                <h2 className="text-xl font-semibold">{form.name}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  We confirmed who this organization is, but claims data wasn't enough to confirm covered-entity status. Tell us which
                  applies and attach evidence. Nothing changes on the connection while this is open.
                </p>
              </div>

              <fieldset className="space-y-3 rounded-lg p-4 ring-1 ring-slate-200">
                <legend className="px-1 text-sm font-semibold">1. Check what we have on file</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="s-name" className="label">Organization name</label>
                    <input id="s-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="s-npi" className="label">NPI</label>
                    <input id="s-npi" className="input font-mono" value={form.npi} onChange={(e) => setForm({ ...form, npi: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="s-addr" className="label">Address</label>
                    <input id="s-addr" className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="s-type" className="label">Entry type</label>
                    <select id="s-type" className="input" value={form.entryType} onChange={(e) => setForm({ ...form, entryType: e.target.value })}>
                      <option>Organization</option>
                      <option>Practitioner</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Changes here update the same record. We rerun the checks when you submit.</p>
              </fieldset>

              <fieldset className="space-y-3 rounded-lg p-4 ring-1 ring-slate-200">
                <legend className="px-1 text-sm font-semibold">2. Which describes this organization?</legend>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" name="ce" className="mt-1" checked={status === "ce"} onChange={() => setStatus("ce")} />
                  <span>
                    <span className="font-medium">HIPAA covered entity</span>
                    <span className="block text-xs text-slate-500">Provider that bills electronically, health plan, or clearinghouse</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" name="ce" className="mt-1" checked={status === "non-ce"} onChange={() => setStatus("non-ce")} />
                  <span>
                    <span className="font-medium">Provider, not a covered entity</span>
                    <span className="block text-xs text-slate-500">Delivers treatment but doesn't bill electronically</span>
                  </span>
                </label>
                <div className="max-w-md">
                  <label htmlFor="s-ev" className="label">Evidence type</label>
                  <select id="s-ev" className="input">
                    <option>[Accepted evidence types from final vetting policy]</option>
                  </select>
                </div>
              </fieldset>

              <fieldset className="space-y-2 rounded-lg p-4 ring-1 ring-slate-200">
                <legend className="px-1 text-sm font-semibold">3. Attach evidence</legend>
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
                I confirm this information is accurate and I'm authorized to submit it for {S.submitter}.
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary">Save draft</button>
                <button type="submit" className="btn-primary" disabled={!attested}>Submit for review</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
