import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAllOrganizations } from "../hooks/useOrganizations";
import { roleOf, ROLES, partOfId, type RceRole } from "../lib/rce-profiles";
import ProfileBadge from "../components/ProfileBadge";
import ErrorBanner from "../components/ErrorBanner";
import Spinner from "../components/Spinner";

export default function DirectoryListPage() {
  const q = useAllOrganizations();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RceRole | "All" | "Unknown">(
    "All",
  );
  const [activeOnly, setActiveOnly] = useState(false);

  const filtered = useMemo(() => {
    const all = q.data ?? [];
    const needle = search.trim().toLowerCase();
    return all.filter((o) => {
      const role = roleOf(o);
      if (roleFilter !== "All" && role !== roleFilter) return false;
      if (activeOnly && o.active === false) return false;
      if (!needle) return true;
      const hay = [
        o.name,
        o.id,
        ...(o.identifier ?? []).map((i) => i.value),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q.data, search, roleFilter, activeOnly]);

  if (q.isLoading) return <Spinner label="Loading directory..." />;
  if (q.isError) return <ErrorBanner error={q.error} />;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Directory</h1>
          <p className="text-sm text-slate-500">
            {filtered.length} of {q.data?.length ?? 0} organizations
          </p>
        </div>
        <Link to="/organization/new" className="btn-primary">
          + New organization
        </Link>
      </header>

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search by name, ID, or identifier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-xs"
          value={roleFilter}
          onChange={(e) =>
            setRoleFilter(e.target.value as RceRole | "All" | "Unknown")
          }
        >
          <option value="All">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="Unknown">Unknown (no profile)</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Active only
        </label>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600 border-b border-slate-200">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">TEFCA ID</th>
              <th className="px-4 py-2 font-medium">Parent</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const pid = partOfId(o);
              const parent = pid
                ? q.data?.find((x) => x.id === pid)
                : undefined;
              return (
                <tr
                  key={o.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-2">
                    <Link
                      to={`/organization/${o.id}`}
                      className="text-slate-900 hover:underline"
                    >
                      {o.name ?? `(unnamed) ${o.id}`}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <ProfileBadge role={roleOf(o)} />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">
                    {o.identifier?.[0]?.value ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {parent ? (
                      <Link
                        to={`/organization/${parent.id}`}
                        className="hover:underline"
                      >
                        {parent.name ?? parent.id}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {o.active === false ? (
                      <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded">
                        inactive
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/organization/${o.id}/edit`}
                      className="text-slate-500 hover:text-slate-900 text-xs"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            No organizations match.
          </div>
        )}
      </div>
    </div>
  );
}
