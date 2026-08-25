import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fhir, bundleEntries } from "../lib/fhir-client";

/** All organizations on the server (paginated under the hood). */
export function useAllOrganizations() {
  return useQuery({
    queryKey: ["Organization", "all"],
    queryFn: async (): Promise<fhir4.Organization[]> => {
      const out: fhir4.Organization[] = [];
      let bundle: fhir4.Bundle<fhir4.Organization> | undefined =
        await fhir.search<fhir4.Organization>("Organization", { _count: 200 });
      while (bundle) {
        out.push(...bundleEntries(bundle));
        const next: string | undefined = bundle.link?.find(
          (l) => l.relation === "next",
        )?.url;
        if (!next) break;
        bundle = (await fetch(next, {
          headers: { Accept: "application/fhir+json" },
        }).then((r) => r.json())) as fhir4.Bundle<fhir4.Organization>;
      }
      return out;
    },
  });
}

export function useOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ["Organization", id],
    enabled: !!id,
    queryFn: () => fhir.read<fhir4.Organization>("Organization", id!),
  });
}

export function useServerMetadata() {
  return useQuery({
    queryKey: ["metadata"],
    queryFn: () => fhir.metadata(),
    retry: 0,
    staleTime: 5 * 60_000,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (org: fhir4.Organization) =>
      fhir.create<fhir4.Organization>(org),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["Organization"] }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (org: fhir4.Organization) =>
      fhir.update<fhir4.Organization>(org),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["Organization", "all"] });
      if (data.id) qc.invalidateQueries({ queryKey: ["Organization", data.id] });
    },
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fhir.remove("Organization", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["Organization"] }),
  });
}
