import type { CheckResult, MatchStatus } from "../../lib/verification/types";

const STATUS: Record<MatchStatus, { label: string; short: string; cls: string; icon: JSX.Element }> = {
  verified: {
    label: "Verified",
    short: "Verified",
    cls: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    icon: <path d="M5 12l5 5 9-10" />,
  },
  partial: {
    label: "Partially verified",
    short: "Partial",
    cls: "bg-amber-50 text-amber-800 ring-amber-200",
    icon: <path d="M12 4l9 16H3z" />,
  },
  unable: {
    label: "Unable to verify",
    short: "Unable",
    cls: "bg-red-700 text-white ring-red-700",
    icon: <path d="M7 7l10 10M17 7L7 17" />,
  },
};

export function StatusChip({ status, short = false }: { status: MatchStatus; short?: boolean }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ring-1 ${s.cls}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
        {s.icon}
      </svg>
      {short ? s.short : s.label}
    </span>
  );
}

const CHECK: Record<CheckResult, { label: string; cls: string }> = {
  pass: { label: "Pass", cls: "text-emerald-700" },
  question: { label: "Question", cls: "text-amber-700" },
  "not-run": { label: "Not run", cls: "text-slate-500" },
};

export function CheckChip({ result }: { result: CheckResult }) {
  const c = CHECK[result];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.cls}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        {result === "pass" && <path d="M5 12l5 5 9-10" />}
        {result === "question" && <path d="M12 4l9 16H3z" />}
        {result === "not-run" && <circle cx="12" cy="12" r="8" />}
      </svg>
      {c.label}
    </span>
  );
}

export function SampleBadge() {
  return (
    <span
      className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600"
      title="Read from src/lib/verification/sample.ts, not the FHIR server"
    >
      Sample data
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
      Live from FHIR server
    </span>
  );
}
