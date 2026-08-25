import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import { useAllOrganizations } from "../hooks/useOrganizations";
import {
  partOfId,
  roleOf,
  ROLE_COLORS,
  type RceRole,
} from "../lib/rce-profiles";
import ProfileBadge from "../components/ProfileBadge";
import ErrorBanner from "../components/ErrorBanner";
import Spinner from "../components/Spinner";

const NODE_W = 220;
const NODE_H = 70;

function OrgNode({ data }: NodeProps<Node<{ org: fhir4.Organization }>>) {
  const role = roleOf(data.org);
  return (
    <div
      className="rounded-md shadow-sm bg-white border-l-4 px-3 py-2 text-left"
      style={{
        width: NODE_W,
        borderLeftColor: ROLE_COLORS[role as RceRole | "Unknown"],
      }}
    >
      <div className="text-sm font-medium truncate">
        {data.org.name ?? data.org.id}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <ProfileBadge role={role} />
        {data.org.active === false && (
          <span className="text-[10px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
            inactive
          </span>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { org: OrgNode };

function layout(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 30, ranksep: 60 });
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      return {
        ...n,
        position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
        sourcePosition:
          direction === "TB" ? Position.Bottom : Position.Right,
        targetPosition: direction === "TB" ? Position.Top : Position.Left,
      };
    }),
    edges,
  };
}

export default function HierarchyPage() {
  const q = useAllOrganizations();
  const navigate = useNavigate();

  const { nodes, edges } = useMemo(() => {
    const orgs = q.data ?? [];
    if (orgs.length === 0) return { nodes: [], edges: [] };
    const rawNodes: Node[] = orgs.map((o) => ({
      id: o.id!,
      type: "org",
      position: { x: 0, y: 0 },
      data: { org: o },
    }));
    const rawEdges: Edge[] = orgs.flatMap((o) => {
      const pid = partOfId(o);
      if (!pid || !o.id) return [];
      return [
        {
          id: `${pid}-${o.id}`,
          source: pid,
          target: o.id,
          style: { stroke: "#94a3b8", strokeWidth: 1.5 },
          animated: false,
        },
      ];
    });
    return layout(rawNodes, rawEdges, "TB");
  }, [q.data]);

  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      navigate(`/organization/${node.id}`);
    },
    [navigate],
  );

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorBanner error={q.error} />;

  if (nodes.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500">
        No organizations to graph yet. Load sample data from the dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-2xl font-semibold">Hierarchy</h1>
        <p className="text-sm text-slate-500">
          {nodes.length} organizations · click a node to open it. Colors follow
          RCE roles: QHIN, Participant, Subparticipant, Child.
        </p>
      </header>
      <div
        className="card overflow-hidden"
        style={{ height: "calc(100vh - 220px)", minHeight: 500 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
        >
          <Background gap={20} color="#e2e8f0" />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  );
}
