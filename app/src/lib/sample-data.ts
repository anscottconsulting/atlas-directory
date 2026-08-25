/**
 * Sample RCE Directory data, modeled after the IG's worked examples.
 *
 * Two QHINs, three Participants, six Subparticipants, two Children — enough
 * to exercise the dashboard counts and the hierarchy graph at every depth.
 *
 * Posted as a transaction Bundle so HAPI assigns IDs and stitches the
 * partOf references using urn:uuid placeholders.
 */

import { PROFILE } from "./rce-profiles";

const TEFCAID_SYSTEM = "urn:oid:2.16.840.1.113883.3.7204.1.5.1.1";

interface SampleSpec {
  ref: string; // urn:uuid placeholder
  role: keyof typeof PROFILE;
  name: string;
  tefcaId: string;
  parent?: string; // ref of parent
  active?: boolean;
  endpoint?: {
    name: string;
    address: string;
    connectionType: string; // CodeSystem-endpoint-connection-type code
  };
}

const SPECS: SampleSpec[] = [
  // QHIN A
  {
    ref: "urn:uuid:qhin-a",
    role: "QHIN",
    name: "QHIN A",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.1",
    endpoint: {
      name: "QHIN A XCA endpoint",
      address: "https://qhin-a.example.org/xca",
      connectionType: "ihe-xca",
    },
  },
  {
    ref: "urn:uuid:p1",
    role: "Participant",
    name: "Participant 1",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.1.1",
    parent: "urn:uuid:qhin-a",
    endpoint: {
      name: "Participant 1 endpoint",
      address: "https://p1.example.org/xca",
      connectionType: "ihe-xca",
    },
  },
  {
    ref: "urn:uuid:sub-y",
    role: "Subparticipant",
    name: "Sub Y",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.1.1.2",
    parent: "urn:uuid:p1",
    endpoint: {
      name: "Sub Y endpoint",
      address: "https://sub-y.example.org/xca",
      connectionType: "ihe-xca",
    },
  },
  {
    ref: "urn:uuid:sub-z",
    role: "Subparticipant",
    name: "Sub Z",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.1.1.1",
    parent: "urn:uuid:p1",
    endpoint: {
      name: "Sub Z endpoint",
      address: "https://sub-z.example.org/xca",
      connectionType: "ihe-xca",
    },
  },
  {
    ref: "urn:uuid:p2",
    role: "Participant",
    name: "Participant 2",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.1.2",
    parent: "urn:uuid:qhin-a",
    endpoint: {
      name: "Participant 2 endpoint",
      address: "https://p2.example.org/xca",
      connectionType: "ihe-xca",
    },
  },
  {
    ref: "urn:uuid:sub-x",
    role: "Child",
    name: "Sub X",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.1.2.1",
    parent: "urn:uuid:p2",
  },
  {
    ref: "urn:uuid:sub-x-clinic",
    role: "Child",
    name: "Sub X Downtown Clinic",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.1.2.1.1",
    parent: "urn:uuid:sub-x",
  },

  // QHIN B
  {
    ref: "urn:uuid:qhin-b",
    role: "QHIN",
    name: "QHIN B",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.2",
    endpoint: {
      name: "QHIN B XCA endpoint",
      address: "https://qhin-b.example.org/xca",
      connectionType: "ihe-xca",
    },
  },
  {
    ref: "urn:uuid:p3",
    role: "Participant",
    name: "Participant 3",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.2.3",
    parent: "urn:uuid:qhin-b",
    endpoint: {
      name: "Participant 3 endpoint",
      address: "https://p3.example.org/xca",
      connectionType: "ihe-xca",
    },
  },
  {
    ref: "urn:uuid:sub-w",
    role: "Subparticipant",
    name: "Sub W",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.2.3.1",
    parent: "urn:uuid:p3",
    endpoint: {
      name: "Sub W endpoint",
      address: "https://sub-w.example.org/xca",
      connectionType: "ihe-xca",
    },
  },
  {
    ref: "urn:uuid:sub-u",
    role: "Subparticipant",
    name: "Sub U",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.2.3.1.1",
    parent: "urn:uuid:sub-w",
    endpoint: {
      name: "Sub U endpoint",
      address: "https://sub-u.example.org/xca",
      connectionType: "ihe-xca",
    },
  },
  {
    ref: "urn:uuid:sub-v",
    role: "Subparticipant",
    name: "Sub V",
    tefcaId: "2.16.840.1.113883.3.7204.1.5.2.2.3.2",
    parent: "urn:uuid:p3",
    endpoint: {
      name: "Sub V endpoint",
      address: "https://sub-v.example.org/xca",
      connectionType: "ihe-xca",
    },
  },
];

function buildOrganization(spec: SampleSpec): fhir4.Organization {
  const org: fhir4.Organization = {
    resourceType: "Organization",
    meta: { profile: [PROFILE[spec.role]] },
    active: spec.active ?? true,
    name: spec.name,
    identifier: [{ system: TEFCAID_SYSTEM, value: spec.tefcaId }],
  };
  if (spec.parent) {
    org.partOf = { reference: spec.parent };
  }
  if (spec.endpoint && spec.role !== "Child") {
    const endpointId = "ep1";
    const endpoint: fhir4.Endpoint = {
      resourceType: "Endpoint",
      id: endpointId,
      meta: { profile: [PROFILE.Endpoint] },
      status: "active",
      connectionType: {
        system: "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
        code: spec.endpoint.connectionType,
      },
      name: spec.endpoint.name,
      payloadType: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/endpoint-payload-type",
              code: "none",
              display: "None",
            },
          ],
        },
      ],
      address: spec.endpoint.address,
    };
    org.contained = [endpoint];
    org.endpoint = [{ reference: `#${endpointId}` }];
  }
  return org;
}

export function buildSampleBundle(): fhir4.Bundle {
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: SPECS.map((spec) => ({
      fullUrl: spec.ref,
      resource: buildOrganization(spec),
      request: { method: "POST", url: "Organization" },
    })),
  };
}

export const SAMPLE_BUNDLE_SIZE = SPECS.length;
