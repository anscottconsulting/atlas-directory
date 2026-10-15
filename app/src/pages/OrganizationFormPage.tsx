import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useAllOrganizations,
  useCreateOrganization,
  useOrganization,
  useUpdateOrganization,
} from "../hooks/useOrganizations";
import {
  PROFILE,
  RULES,
  ROLES,
  containedEndpoint,
  partOfId,
  roleOf,
  setRole,
  type RceRole,
} from "../lib/rce-profiles";
import { isValidNpi, NPI_SYSTEM } from "../lib/verification/rules";
import { EIN_SYSTEM, einFormatProblem } from "../lib/verification/identity";
import ErrorBanner from "../components/ErrorBanner";
import Spinner from "../components/Spinner";

const TEFCAID_SYSTEM = "urn:oid:2.16.840.1.113883.3.7204.1.5.1.1";

interface FormState {
  role: RceRole;
  name: string;
  active: boolean;
  tefcaId: string;
  npi: string;
  ein: string;
  partOfId: string;
  endpointName: string;
  endpointAddress: string;
  endpointConnectionType: string;
}

const EMPTY: FormState = {
  role: "Child",
  name: "",
  active: true,
  tefcaId: "",
  npi: "",
  ein: "",
  partOfId: "",
  endpointName: "",
  endpointAddress: "",
  endpointConnectionType: "ihe-xca",
};

function isUrl(s: string): boolean {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

/** Role-aware validation. Returns a {field: message} map, empty when valid. */
function validate(state: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!state.name.trim()) errors.name = "Name is required";
  if (!state.tefcaId.trim()) errors.tefcaId = "TEFCA ID is required";
  if (state.npi.trim() && !isValidNpi(state.npi.trim())) errors.npi = "Not a valid NPI (10 digits, with check digit)";
  const einProblem = state.ein.trim() ? einFormatProblem(state.ein) : null;
  if (einProblem) errors.ein = einProblem;

  if (RULES.allowsPartOf(state.role)) {
    if (state.role === "Participant" && !state.partOfId) {
      errors.partOfId = "Participants need a QHIN parent";
    }
    if (
      (state.role === "Subparticipant" || state.role === "Child") &&
      !state.partOfId
    ) {
      errors.partOfId = "Parent is required for this role";
    }
  }

  // Endpoint validation only when the user has filled in an address
  if (
    RULES.allowsEndpoint(state.role) &&
    state.endpointAddress.trim() !== ""
  ) {
    if (!state.endpointName.trim())
      errors.endpointName = "Endpoint name required";
    if (!isUrl(state.endpointAddress))
      errors.endpointAddress = "Endpoint address must be a valid URL";
    if (!state.endpointConnectionType.trim())
      errors.endpointConnectionType = "Connection type required";
  }
  return errors;
}

function stateToOrg(state: FormState, existing?: fhir4.Organization): fhir4.Organization {
  let org: fhir4.Organization = setRole(
    existing
      ? { ...existing }
      : { resourceType: "Organization", active: true },
    state.role,
  );
  org.name = state.name.trim();
  org.active = state.active;

  const others = (org.identifier ?? []).filter(
    (i) => i.system !== TEFCAID_SYSTEM && i.system !== NPI_SYSTEM && i.system !== EIN_SYSTEM,
  );
  org.identifier = [
    ...others,
    { system: TEFCAID_SYSTEM, value: state.tefcaId.trim() },
    ...(state.npi.trim() ? [{ system: NPI_SYSTEM, value: state.npi.trim() }] : []),
    ...(state.ein.trim() ? [{ system: EIN_SYSTEM, value: state.ein.trim() }] : []),
  ];

  if (RULES.allowsPartOf(state.role) && state.partOfId) {
    org.partOf = { reference: `Organization/${state.partOfId}` };
  } else {
    delete org.partOf;
  }

  if (RULES.allowsEndpoint(state.role) && state.endpointAddress.trim()) {
    const endpoint: fhir4.Endpoint = {
      resourceType: "Endpoint",
      id: "ep1",
      meta: { profile: [PROFILE.Endpoint] },
      status: "active",
      name: state.endpointName.trim(),
      connectionType: {
        system: "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
        code: state.endpointConnectionType.trim(),
      },
      payloadType: [
        {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/endpoint-payload-type",
              code: "none",
              display: "None",
            },
          ],
        },
      ],
      address: state.endpointAddress.trim(),
    };
    org.contained = [
      ...(org.contained ?? []).filter(
        (r) => !(r.resourceType === "Endpoint" && r.id === "ep1"),
      ),
      endpoint,
    ];
    org.endpoint = [{ reference: "#ep1" }];
  } else {
    delete org.endpoint;
    if (org.contained) {
      org.contained = org.contained.filter((r) => r.resourceType !== "Endpoint");
      if (org.contained.length === 0) delete org.contained;
    }
  }

  return org;
}

function orgToState(org: fhir4.Organization): FormState {
  const role = roleOf(org);
  const ep = containedEndpoint(org);
  return {
    role: role === "Unknown" ? "Child" : role,
    name: org.name ?? "",
    active: org.active !== false,
    tefcaId:
      org.identifier?.find((i) => i.system === TEFCAID_SYSTEM)?.value ?? "",
    npi: org.identifier?.find((i) => i.system === NPI_SYSTEM)?.value ?? "",
    ein: org.identifier?.find((i) => i.system === EIN_SYSTEM)?.value ?? "",
    partOfId: partOfId(org) ?? "",
    endpointName: ep?.name ?? "",
    endpointAddress: ep?.address ?? "",
    endpointConnectionType: ep?.connectionType?.code ?? "ihe-xca",
  };
}

export default function OrganizationFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = !!id;
  const navigate = useNavigate();
  const allQ = useAllOrganizations();
  const orgQ = useOrganization(id);
  const create = useCreateOrganization();
  const update = useUpdateOrganization();

  const [state, setState] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (orgQ.data) setState(orgToState(orgQ.data));
  }, [orgQ.data]);

  const validParents = useMemo(() => {
    const parents = RULES.validParents(state.role);
    const all = allQ.data ?? [];
    return all.filter((o) => {
      if (o.id === id) return false; // can't be your own parent
      const r = roleOf(o);
      return r !== "Unknown" && parents.includes(r as RceRole);
    });
  }, [allQ.data, state.role, id]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const issues = validate(state);
    setErrors(issues);
    if (Object.keys(issues).length > 0) return;
    try {
      if (editing && orgQ.data) {
        const updated = stateToOrg(state, orgQ.data);
        await update.mutateAsync(updated);
        navigate(`/organization/${id}`);
      } else {
        const created = stateToOrg(state);
        const out = await create.mutateAsync(created);
        navigate(`/organization/${out.id}`);
      }
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : String(err) });
    }
  }

  if (editing && orgQ.isLoading) return <Spinner />;
  if (editing && orgQ.isError) return <ErrorBanner error={orgQ.error} />;

  const submitting = create.isPending || update.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">
          {editing ? "Edit organization" : "New organization"}
        </h1>
        <p className="text-sm text-slate-500">
          Role-aware form. Picking a different role can hide or require fields
          based on the RCE IG.
        </p>
      </header>

      {errors.form && <ErrorBanner error={errors.form} />}

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={state.role}
              onChange={(e) => set("role", e.target.value as RceRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {state.role === "QHIN" &&
                "Top-level entity. Cannot have a parent."}
              {state.role === "Participant" && "Direct child of a QHIN."}
              {state.role === "Subparticipant" &&
                "Direct child of a Participant or another Subparticipant."}
              {state.role === "Child" &&
                "Leaf-style org. Cannot have an Endpoint."}
            </p>
          </div>
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={state.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Acme Health Network"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
            )}
          </div>
          <div>
            <label className="label">TEFCA ID</label>
            <input
              className="input font-mono"
              value={state.tefcaId}
              onChange={(e) => set("tefcaId", e.target.value)}
              placeholder="2.16.840.1.113883.3.7204.1.5.2.x"
            />
            {errors.tefcaId && (
              <p className="mt-1 text-xs text-red-600">{errors.tefcaId}</p>
            )}
          </div>
          <div>
            <label className="label">NPI (optional)</label>
            <input
              className="input font-mono"
              value={state.npi}
              onChange={(e) => set("npi", e.target.value)}
              placeholder="10 digits"
            />
            {errors.npi && (
              <p className="mt-1 text-xs text-red-600">{errors.npi}</p>
            )}
          </div>
          <div>
            <label className="label">EIN (optional)</label>
            <input
              className="input font-mono"
              value={state.ein}
              onChange={(e) => set("ein", e.target.value)}
              placeholder="NN-NNNNNNN"
            />
            {errors.ein && (
              <p className="mt-1 text-xs text-red-600">{errors.ein}</p>
            )}
          </div>
          <div>
            <label className="label">Active</label>
            <select
              className="input"
              value={state.active ? "true" : "false"}
              onChange={(e) => set("active", e.target.value === "true")}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        {RULES.allowsPartOf(state.role) && (
          <div>
            <label className="label">Parent organization (partOf)</label>
            <select
              className="input"
              value={state.partOfId}
              onChange={(e) => set("partOfId", e.target.value)}
            >
              <option value="">— none — (invalid for this role)</option>
              {validParents.map((p) => (
                <option key={p.id} value={p.id}>
                  [{roleOf(p)}] {p.name ?? p.id}
                </option>
              ))}
            </select>
            {errors.partOfId && (
              <p className="mt-1 text-xs text-red-600">{errors.partOfId}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Valid parents for {state.role}:{" "}
              {RULES.validParents(state.role).join(", ") || "none"}
            </p>
          </div>
        )}
      </div>

      {RULES.allowsEndpoint(state.role) && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Endpoint (contained)</h2>
          <p className="text-xs text-slate-500 -mt-2">
            Leave the address blank if this org has no endpoint. The RCE IG
            stores Endpoints as contained resources inside the Organization.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={state.endpointName}
                onChange={(e) => set("endpointName", e.target.value)}
                placeholder="e.g. Acme XCA endpoint"
              />
              {errors.endpointName && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.endpointName}
                </p>
              )}
            </div>
            <div>
              <label className="label">Connection type code</label>
              <input
                className="input font-mono"
                value={state.endpointConnectionType}
                onChange={(e) =>
                  set("endpointConnectionType", e.target.value)
                }
                placeholder="ihe-xca"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address (URL)</label>
              <input
                className="input font-mono"
                value={state.endpointAddress}
                onChange={(e) => set("endpointAddress", e.target.value)}
                placeholder="https://acme.example.org/xca"
              />
              {errors.endpointAddress && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.endpointAddress}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link
          to={editing ? `/organization/${id}` : "/directory"}
          className="btn-secondary"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting}
        >
          {submitting ? "Saving..." : editing ? "Save changes" : "Create"}
        </button>
      </div>
    </form>
  );
}
