/**
 * Minimal FHIR REST client.
 *
 * The base URL is "/fhir" so requests are same-origin and forwarded to the
 * local HAPI container by the Vite dev proxy (see vite.config.ts).
 */

const BASE = "/fhir";

export class FhirError extends Error {
  status: number;
  outcome?: fhir4.OperationOutcome;

  constructor(status: number, message: string, outcome?: fhir4.OperationOutcome) {
    super(message);
    this.status = status;
    this.outcome = outcome;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/fhir+json",
      ...(init.body ? { "Content-Type": "application/fhir+json" } : {}),
      ...init.headers,
    },
  });

  // 204 No Content (delete) — nothing to parse
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const outcome =
      body && body.resourceType === "OperationOutcome"
        ? (body as fhir4.OperationOutcome)
        : undefined;
    const msg =
      outcome?.issue?.[0]?.diagnostics ||
      outcome?.issue?.[0]?.details?.text ||
      res.statusText ||
      `HTTP ${res.status}`;
    throw new FhirError(res.status, msg, outcome);
  }

  return body as T;
}

export const fhir = {
  /** Server CapabilityStatement — useful as a health check. */
  metadata: () => request<fhir4.CapabilityStatement>("/metadata"),

  /** Search a resource type. Returns a Bundle. */
  search: <T extends fhir4.Resource = fhir4.Resource>(
    resourceType: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<fhir4.Bundle<T>> => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") q.set(k, String(v));
    }
    const qs = q.toString();
    return request<fhir4.Bundle<T>>(
      `/${resourceType}${qs ? `?${qs}` : ""}`,
    );
  },

  /** Read a single resource by ID. */
  read: <T extends fhir4.Resource = fhir4.Resource>(
    resourceType: string,
    id: string,
  ): Promise<T> => request<T>(`/${resourceType}/${id}`),

  /** Create a resource (POST). Server assigns the ID. */
  create: <T extends fhir4.Resource = fhir4.Resource>(
    resource: T,
  ): Promise<T> =>
    request<T>(`/${resource.resourceType}`, {
      method: "POST",
      body: JSON.stringify(resource),
    }),

  /** Update a resource (PUT). Client-supplied ID. */
  update: <T extends fhir4.Resource = fhir4.Resource>(
    resource: T,
  ): Promise<T> => {
    if (!resource.id) throw new Error("update() requires resource.id");
    return request<T>(`/${resource.resourceType}/${resource.id}`, {
      method: "PUT",
      body: JSON.stringify(resource),
    });
  },

  /** Delete a resource. */
  remove: (resourceType: string, id: string): Promise<void> =>
    request<void>(`/${resourceType}/${id}`, { method: "DELETE" }),

  /**
   * Validate a resource against a profile ($validate). Returns the
   * OperationOutcome; servers may answer a failing resource with a 4xx, so
   * an outcome carried on the error is returned instead of thrown.
   */
  validate: async (
    resource: fhir4.Resource,
    profile: string,
  ): Promise<fhir4.OperationOutcome> => {
    try {
      return await request<fhir4.OperationOutcome>(
        `/${resource.resourceType}/$validate?profile=${encodeURIComponent(profile)}`,
        { method: "POST", body: JSON.stringify(resource) },
      );
    } catch (e) {
      if (e instanceof FhirError && e.outcome) return e.outcome;
      throw e;
    }
  },

  /** POST a transaction Bundle. */
  transaction: (bundle: fhir4.Bundle): Promise<fhir4.Bundle> =>
    request<fhir4.Bundle>("", {
      method: "POST",
      body: JSON.stringify(bundle),
    }),

  /**
   * Invoke a FHIR operation. Body is a Parameters resource (or empty).
   * If `id` is provided the operation is instance-level; otherwise type-level.
   */
  operation: <T extends fhir4.Resource = fhir4.Resource>(
    resourceType: string,
    op: string,
    id?: string,
    parameters?: fhir4.Parameters,
  ): Promise<T> => {
    const path = id
      ? `/${resourceType}/${id}/${op}`
      : `/${resourceType}/${op}`;
    return request<T>(path, {
      method: "POST",
      body: JSON.stringify(
        parameters ?? { resourceType: "Parameters" },
      ),
    });
  },
};

/** Pull every resource out of a Bundle (handles missing entry array). */
export function bundleEntries<T extends fhir4.Resource>(
  bundle: fhir4.Bundle<T> | undefined,
): T[] {
  if (!bundle?.entry) return [];
  return bundle.entry
    .map((e) => e.resource)
    .filter((r): r is T => !!r);
}
