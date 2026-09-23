import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Metric } from "../components/ui";

export function Dashboard() {
  const [execs, setExecs] = useState<{ id: string; engine: string; status: string; createdAt: string }[]>([]);
  const [fusion, setFusion] = useState<{ snapshot?: Record<string, number> } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<typeof execs>("/api/v1/executions"), api("/api/v1/fusion")])
      .then(([e, f]) => {
        setExecs(e);
        setFusion(f as { snapshot?: Record<string, number> });
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Dashboard</h2>
      <p className="text-sm text-neutral-700 mb-6 max-w-3xl">
        PARADOX separates claims, evidence, contradictions, unknowns, and decisions. Empty metrics mean no data — they are
        never invented.
      </p>
      {err ? <p className="text-danger text-sm mb-4">API: {err}. Start the API on port 8787.</p> : null}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <Metric label="Claims in fusion" value={fusion?.snapshot?.claimCount ?? 0} />
        <Metric label="Evidence objects" value={fusion?.snapshot?.evidenceCount ?? 0} />
        <Metric label="Sources" value={fusion?.snapshot?.sourceCount ?? 0} />
        <Metric label="Fusion events" value={fusion?.snapshot?.eventCount ?? 0} />
      </div>
      <div className="flex gap-3 mb-8">
        <Link className="border border-accent px-3 py-2 text-sm" to="/verify">
          Verify a claim
        </Link>
        <Link className="border border-line px-3 py-2 text-sm" to="/research">
          Research a question
        </Link>
      </div>
      <h3 className="font-medium mb-2">Recent executions</h3>
      <table className="w-full text-sm border border-line bg-white">
        <thead>
          <tr className="text-left border-b border-line">
            <th className="p-2">Engine</th>
            <th className="p-2">Status</th>
            <th className="p-2">Id</th>
            <th className="p-2">Time</th>
          </tr>
        </thead>
        <tbody>
          {execs.map((e) => (
            <tr key={e.id} className="border-b border-line">
              <td className="p-2">{e.engine}</td>
              <td className="p-2">{e.status}</td>
              <td className="p-2 font-mono text-xs">{e.id}</td>
              <td className="p-2">{new Date(e.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {!execs.length ? (
            <tr>
              <td className="p-2" colSpan={4}>
                No executions yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
