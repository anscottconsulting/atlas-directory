import { NavLink, Outlet } from "react-router-dom";
import { ISSUES, RUN } from "../../lib/verification/sample";

const tabs = [
  { to: "/verify", label: "Overview", end: true },
  { to: "/verify/queue", label: "Queue", count: RUN.partial + RUN.unable },
  { to: "/verify/issues", label: "Issues", count: ISSUES.length },
  { to: "/verify/quality", label: "Data quality" },
  { to: "/verify/submitter-level-1", label: "Submitter Level 1 Validation" },
  { to: "/verify/submitter", label: "Submitter Level 2 Validation" },
];

export default function VerifyLayout() {
  return (
    <div className="space-y-6">
      <nav aria-label="Validation" className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`
            }
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs font-normal text-slate-400">{t.count}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
