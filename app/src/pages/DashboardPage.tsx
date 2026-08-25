import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAllOrganizations } from "../hooks/useOrganizations";
import { fhir } from "../lib/fhir-client";
import {
  partOfId,
  roleOf,
  ROLES,
  ROLE_COLORS,
  type RceRole,
} from "../lib/rce-profiles";
import { buildSampleBundle, SAMPLE_BUNDLE_SIZE } from "../lib/sample-data";
import StatCard from "../components/StatCard";
import ProfileBadge from "../components/ProfileBadge";
import ErrorBanner from "../components/ErrorBanner";
import Spinner from "../components/Spinner";

export default function DashboardPage() {
  const q = useAllOrganizations();
  const qc = useQueryClient();

  const seed = useMutation({
    mutationFn: () => fhir.transaction(buildSampleBundle()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["Organization"] }),
  });

  if (q.isLoading) return <Spinner label="Loading directory..." />;
  if (q.isError)
    return (
      <ErrorBanner
        title="Couldn't reach the FHIR server"
        error={q.error}
      />
    );

  const orgs = q.data ?? [];
  const byRole: Record<RceRole | "Unknown", fhir4.Organization[]> = {
    QHIN: [],
    Participant: [],
    Subparticipant: [],
    Child: [],
    Unknown: [],
  };
  for (const o of orgs) byRole[roleOf(o)].push(o);

  // Descendant counts from each top-level org (any role with no parent)
  const childrenById = new Map<string, string[]>();
  for (const o of orgs) {
    const pid = partOfId(o);
    if (pid && o.id) {
      const list = childrenById.get(pid) ?? [];
      list.push(o.id);
      childrenById.set(pid, list);
    }
  }
  function descendantCount(id: string): number {
    const direct = childrenById.get(id) ?? [];
    return direct.length + direct.reduce((sum, c) => sum + descendantCount(c), 0);
  }

  const roots = orgs.filter((o) => !partOfId(o));
  const endpoints = orgs.reduce(
    (n, o) => n + (o.contained?.filter((c) => c.resourceType === "Endpoint").length ?? 0),
    0,
  );
  const active = orgs.filter((o) => o.active !== false).length;
  const totalDescendants = roots.reduce(
    (n, r) => (r.id ? n + descendantCount(r.id) : n),
    0,
  );

  const topByDescendants = [...roots]
    .map((r) => ({ org: r, count: r.id ? descendantCount(r.id) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Provider directory · {orgs.length} organizations indexed
          </p>
        </div>
        <div className="flex gap-2">
          {orgs.length === 0 && (
            <button
              className="btn-primary"
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
            >
              {seed.isPending
                ? "Loading sample data..."
                : `Load sample data (${SAMPLE_BUNDLE_SIZE} orgs)`}
            </button>
          )}
          <Link to="/organization/new" className="btn-secondary">
            + New organization
          </Link>
        </div>
      </header>

      {seed.isError && <ErrorBanner error={seed.error} />}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total organizations"
          value={orgs.length}
          sub={`${active} active`}
        />
        <StatCard
          label="Endpoints"
          value={endpoints}
          sub="contained inside orgs"
        />
        <StatCard
          label="Top-level entities"
          value={roots.length}
          sub="orgs with no partOf"
        />
        <StatCard
          label="Total descendants"
          value={totalDescendants}
          sub="across all roots"
        />
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">By profile</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ROLES.map((role) => (
            <div key={role} className="flex flex-col">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {role}
              </div>
              <div
                className="text-2xl font-semibold"
                style={{ color: ROLE_COLORS[role] }}
              >
                {byRole[role].length}
              </div>
            </div>
          ))}
        </div>
        {byRole.Unknown.length > 0 && (
          <div className="mt-3 text-xs text-slate-500">
            {byRole.Unknown.length} organization(s) have no RCE profile set.
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Top roots by descendant count</h2>
        {topByDescendants.length === 0 ? (
          <p className="text-sm text-slate-500">No top-level orgs yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 font-medium">Organization</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium text-right">Descendants</th>
              </tr>
            </thead>
            <tbody>
              {topByDescendants.map(({ org, count }) => (
                <tr key={org.id} className="border-b border-slate-100">
                  <td className="py-2">
                    <Link
                      to={`/organization/${org.id}`}
                      className="text-slate-900 hover:underline"
                    >
                      {org.name ?? `(unnamed) ${org.id}`}
                    </Link>
                  </td>
                  <td className="py-2">
                    <ProfileBadge role={roleOf(org)} />
                  </td>
                  <td className="py-2 text-right font-mono">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
