import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { GraphView } from "../components/ui";

export function GraphPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api("/api/v1/fusion")
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, []);
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Knowledge graph</h2>
      <p className="text-sm mb-4">Fusion graph of claims, evidence, and sources actually stored in this process.</p>
      {err ? <p className="text-danger text-sm">{err}</p> : null}
      <GraphView nodes={data?.graph?.nodes ?? []} edges={data?.graph?.edges ?? []} />
    </div>
  );
}
