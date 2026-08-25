import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOrganization,
  useAllOrganizations,
  useDeleteOrganization,
} from "../hooks/useOrganizations";
import {
  containedEndpoint,
  partOfId,
  roleOf,
} from "../lib/rce-profiles";
import {
  activateHierarchy,
  deactivateHierarchy,
  updateTefcaId,
} from "../lib/rce-operations";
import ProfileBadge from "../components/ProfileBadge";
import ErrorBanner from "../components/ErrorBanner";
import Spinner from "../components/Spinner";

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orgQ = useOrganization(id);
  const allQ = useAllOrganizations();
  const del = useDeleteOrganization();

  const [opStatus, setOpStatus] = useState<string | null>(null);
  const [opError, setOpError] = useState<unknown>(null);
  const [opBusy, setOpBusy] = useState<string | null>(null);
  const [newTefcaId, setNewTefcaId] = useState("");

  if (orgQ.isLoading || allQ.isLoading) return <Spinner />;
  if (orgQ.isError) return <ErrorBanner error={orgQ.error} />;

  const org = orgQ.data;
  if (!org) return <ErrorBanner error="Organization not found" />;

  const all = allQ.data ?? [];
  const parent = (() => {
    const pid = partOfId(org);
    return pid ? all.find((o) => o.id === pid) : undefined;
  })();
  const children = all.filter((o) => partOfId(o) === id);
  const endpoint = containedEndpoint(org);
  const role = roleOf(org);

  async function runOp(
    name: string,
    fn: () => Promise<{ used: "server" | "client"; count: number }>,
  ) {
    setOpBusy(name);
    setOpStatus(null);
    setOpError(null);
    try {
      const { used, count } = await fn();
      setOpStatus(
        `${name} succeeded on ${count} organization(s) (${
          used === "server" ? "server-side $operation" : "client-side fallback"
        }).`,
      );
      qc.invalidateQueries({ queryKey: ["Organization"] });
    } catch (e) {
      setOpError(e);
    } finally {
      setOpBusy(null);
    }
  }

  async function onDelete() {
    if (!org || !org.id) return;
    if (
      !confirm(
        `Delete "${org.name ?? org.id}"? Children will become orphans unless you delete them first.`,
      )
    )
      return;
    await del.mutateAsync(org.id);
    navigate("/directory");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{org.name ?? "(unnamed)"}</h1>
            <ProfileBadge role={role} size="md" />
            {org.active === false && (
              <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded">
                inactive
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-mono mt-1">{org.id}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/organization/${org.id}/edit`}
            className="btn-secondary"
          >
            Edit
          </Link>
          <button
            className="btn-danger"
            onClick={onDelete}
            disabled={del.isPending}
          >
            {del.isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </header>

      {opStatus && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          {opStatus}
        </div>
      )}
      {!!opError && <ErrorBanner error={opError} />}

      <section className="card p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <Field label="Active">{org.active === false ? "No" : "Yes"}</Field>
        <Field label="Parent (partOf)">
          {parent ? (
            <Link
              to={`/organization/${parent.id}`}
              className="text-slate-900 hover:underline"
            >
              {parent.name ?? parent.id}
            </Link>
          ) : (
            <span className="text-slate-400">— (top-level)</span>
          )}
        </Field>
        <Field label="Direct children">
          {children.length === 0 ? (
            <span className="text-slate-400">none</span>
          ) : (
            <ul className="space-y-1">
              {children.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/organization/${c.id}`}
                    className="text-slate-900 hover:underline"
                  >
                    {c.name ?? c.id}
                  </Link>{" "}
                  <ProfileBadge role={roleOf(c)} />
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="Identifiers">
          {(org.identifier ?? []).length === 0 ? (
            <span className="text-slate-400">none</span>
          ) : (
            <ul className="space-y-0.5 font-mono text-xs">
              {org.identifier!.map((i, idx) => (
                <li key={idx}>
                  <span className="text-slate-500">{i.system ?? ""}</span>{" "}
                  {i.value}
                </li>
              ))}
            </ul>
          )}
        </Field>
      </section>

      {endpoint && (
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Endpoint</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <Field label="Name">{endpoint.name ?? "—"}</Field>
            <Field label="Status">{endpoint.status}</Field>
            <Field label="Address">
              <span className="font-mono text-xs">{endpoint.address}</span>
            </Field>
            <Field label="Connection type">
              {endpoint.connectionType?.code ?? "—"}
            </Field>
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Hierarchy operations</h2>
        <p className="text-xs text-slate-500 mb-3">
          These cascade across this organization and all descendants via{" "}
          <code>partOf</code>. If the server doesn't implement the FHIR{" "}
          <code>$operation</code>, the app applies the same change client-side
          via individual updates.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            className="btn-secondary"
            disabled={!!opBusy}
            onClick={() =>
              runOp("$activate-hierarchy", () => activateHierarchy(org.id!))
            }
          >
            {opBusy === "$activate-hierarchy"
              ? "Activating..."
              : "Activate hierarchy"}
          </button>
          <button
            className="btn-secondary"
            disabled={!!opBusy}
            onClick={() =>
              runOp("$deactivate-hierarchy", () =>
                deactivateHierarchy(org.id!),
              )
            }
          >
            {opBusy === "$deactivate-hierarchy"
              ? "Deactivating..."
              : "Deactivate hierarchy"}
          </button>
          <div className="flex items-center gap-2">
            <input
              className="input max-w-xs"
              placeholder="new TEFCA ID"
              value={newTefcaId}
              onChange={(e) => setNewTefcaId(e.target.value)}
            />
            <button
              className="btn-secondary"
              disabled={!!opBusy || !newTefcaId}
              onClick={() =>
                runOp("$update-tefcaid", () =>
                  updateTefcaId(org.id!, newTefcaId),
                )
              }
            >
              {opBusy === "$update-tefcaid"
                ? "Updating..."
                : "Update TEFCA ID"}
            </button>
          </div>
        </div>
      </section>

      <details className="card p-5">
        <summary className="font-semibold cursor-pointer">
          Raw FHIR JSON
        </summary>
        <pre className="mt-3 overflow-auto text-xs bg-slate-50 p-3 rounded">
          {JSON.stringify(org, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
