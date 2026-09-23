import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function TracePage() {
  const [execs, setExecs] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  useEffect(() => {
    api<any[]>("/api/v1/executions").then(setExecs).catch(() => setExecs([]));
  }, []);
  async function open(id: string) {
    setDetail(await api(`/api/v1/executions/${id}`));
  }
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Execution trace</h2>
      <p className="text-sm mb-4">Auditable pipeline stages. Model chain-of-thought is not stored.</p>
      <ul className="text-sm mb-4">
        {execs.map((e) => (
          <li key={e.id}>
            <button className="underline" onClick={() => open(e.id)}>
              {e.engine} · {e.status} · {e.id}
            </button>
          </li>
        ))}
      </ul>
      {detail?.steps ? (
        <ol className="list-decimal ml-5 text-sm space-y-1">
          {detail.steps.map((s: any) => (
            <li key={s.index}>
              {s.stage} [{s.status}] {s.detail} ({s.latencyMs}ms)
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
