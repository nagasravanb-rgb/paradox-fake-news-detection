import type { CSSProperties } from "react";

export interface GNode {
  id: string;
  kind: string;
  label: string;
}
export interface GEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
}

export function GraphView({ nodes, edges }: { nodes: GNode[]; edges: GEdge[] }) {
  if (!nodes.length) {
    return <p className="text-sm text-neutral-600">No graph nodes — system state is empty for this execution.</p>;
  }
  const w = 920;
  const h = Math.max(280, 80 + nodes.length * 28);
  const cols: Record<string, GNode[]> = {};
  for (const n of nodes) {
    cols[n.kind] = cols[n.kind] ?? [];
    cols[n.kind].push(n);
  }
  const kinds = Object.keys(cols);
  const pos = new Map<string, { x: number; y: number }>();
  kinds.forEach((k, ki) => {
    const list = cols[k];
    list.forEach((n, ni) => {
      pos.set(n.id, {
        x: 80 + (ki * (w - 120)) / Math.max(1, kinds.length - 1 || 1),
        y: 40 + (ni * (h - 80)) / Math.max(1, list.length - 1 || 1),
      });
    });
  });
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Knowledge graph">
      {edges.map((e) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8a8174" strokeWidth={1} />;
      })}
      {nodes.map((n) => {
        const p = pos.get(n.id)!;
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={10} fill="#1f4b3a" />
            <text x={p.x + 14} y={p.y + 4} fontSize={11} fill="#0f1419">
              {n.kind}: {n.label.slice(0, 42)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Metric({ label, value, hint }: { label: string; value: string | number | null | undefined; hint?: string }) {
  return (
    <div className="border border-line bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-600">{label}</div>
      <div className="text-xl font-semibold">{value === null || value === undefined ? "—" : String(value)}</div>
      {hint ? <div className="text-xs text-neutral-500 mt-1">{hint}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const style: CSSProperties = { borderColor: "#1f4b3a" };
  return (
    <span className="inline-block border px-2 py-0.5 text-xs font-medium" style={style}>
      {status}
    </span>
  );
}
