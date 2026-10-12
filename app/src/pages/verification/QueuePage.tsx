import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SampleBadge, StatusChip } from "../../components/verification/StatusChip";
import { PARTIAL_REASONS, QUEUE, RUN, SUBMITTERS } from "../../lib/verification/sample";
import type { MatchStatus, ReasonKey } from "../../lib/verification/types";

type Tab = "all" | MatchStatus | "evidence" | "mine";

const ME = "J. Alvarez";

export default function QueuePage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState<ReasonKey | "">((params.get("reason") as ReasonKey) ?? "");
  const [submitter, setSubmitter] = useState(params.get("submitter") ?? "");
  const [owner, setOwner] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return QUEUE.filter((e) => {
      if (tab === "partial" || tab === "unable") {
        if (e.status !== tab) return false;
      }
      if (tab === "evidence" && e.reasonKey !== "covered-entity") return false;
      if (tab === "mine" && e.owner !== ME) return false;
      if (reason && e.reasonKey !== reason) return false;
      if (submitter && e.submitter !== submitter) return false;
      if (owner === "unassigned" && e.owner) return false;
      if (owner === "me" && e.owner !== ME) return false;
      if (!needle) return true;
      return [e.id, e.org, e.npi, e.candidate, e.candidateNpi]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [tab, search, reason, submitter, owner]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All open", count: RUN.partial + RUN.unable },
    { key: "partial", label: "Partially verified", count: RUN.partial },
    { key: "unable", label: "Unable to verify", count: RUN.unable },
    { key: "evidence", label: "Covered-entity evidence", count: RUN.evidenceRequests },
    { key: "mine", label: "Assigned to me", count: QUEUE.filter((e) => e.owner === ME).length },
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
            {RUN.label} <SampleBadge />
          </div>
          <h1 className="text-2xl font-semibold">Validation queue</h1>
          <p className="text-sm text-slate-500">
            Everything that isn't verified. Verified entries move on without a human touching them.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={selected.size === 0}>
            Assign selected
          </button>
          <button type="button" className="btn-primary" disabled={selected.size === 0}>
            Send clarification requests ({selected.size})
          </button>
        </div>
      </header>

      <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.key ? "border-slate-900 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label} <span className="font-normal text-slate-400">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <Field label="Search" htmlFor="q-search" grow>
          <input id="q-search" className="input" placeholder="Name, NPI or record ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field label="Reason" htmlFor="q-reason">
          <select id="q-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value as ReasonKey | "")}>
            <option value="">Any reason</option>
            {PARTIAL_REASONS.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
            <option value="covered-entity">Covered-entity evidence needed</option>
            <option value="no-candidate">No supported candidate</option>
            <option value="ambiguous">Ambiguous candidates</option>
          </select>
        </Field>
        <Field label="Submitter" htmlFor="q-sub">
          <select id="q-sub" className="input" value={submitter} onChange={(e) => setSubmitter(e.target.value)}>
            <option value="">All submitters</option>
            {SUBMITTERS.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Owner" htmlFor="q-owner">
          <select id="q-owner" className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            <option value="me">Me</option>
          </select>
        </Field>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-slate-600">
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </th>
              <th className="px-3 py-2 font-medium">Record</th>
              <th className="px-3 py-2 font-medium">Organization as listed</th>
              <th className="px-3 py-2 font-medium">Supplied NPI</th>
              <th className="px-3 py-2 font-medium">Best candidate</th>
              <th className="px-3 py-2 font-medium">Match</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Reason</th>
              <th className="px-3 py-2 font-medium">Submitter</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 text-right font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <input type="checkbox" aria-label={`Select ${e.id}`} checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                </td>
                <td className="px-3 py-2.5">
                  <Link to={`/verify/entry/${e.id}`} className="font-mono text-xs text-slate-900 underline">
                    {e.id}
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-medium">{e.org}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{e.npi ?? <span className="text-slate-400">(none)</span>}</td>
                <td className="px-3 py-2.5">
                  <div>{e.candidate}</div>
                  {e.candidateNpi && <div className="font-mono text-xs text-slate-500">{e.candidateNpi}</div>}
                </td>
                <td className="px-3 py-2.5 text-xs">{e.confidence}</td>
                <td className="px-3 py-2.5"><StatusChip status={e.status} short /></td>
                <td className="max-w-[260px] px-3 py-2.5 text-xs text-slate-600">{e.reason}</td>
                <td className="px-3 py-2.5 text-xs">{e.submitter}</td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{e.owner ?? "Unassigned"}</td>
                <td className="px-3 py-2.5 text-right text-xs text-slate-600">{e.ageDays} d</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-500">Nothing matches these filters.</div>}
      </div>

      <div className="text-sm text-slate-500">
        Showing {rows.length} of {QUEUE.length} sample rows · {selected.size} selected
      </div>
    </div>
  );
}

function Field({ label, htmlFor, grow, children }: { label: string; htmlFor: string; grow?: boolean; children: React.ReactNode }) {
  return (
    <div className={grow ? "min-w-[220px] flex-[2]" : "min-w-[160px] flex-1"}>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
    </div>
  );
}
