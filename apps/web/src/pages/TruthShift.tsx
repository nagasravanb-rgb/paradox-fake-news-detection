import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function TruthShiftPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api<any[]>("/api/v1/truth-shift").then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Truth-Shift</h2>
      <p className="text-sm mb-4">
        Claim Shift Index is a PARADOX-defined metric of evidentiary change, not a published academic index.
      </p>
      <table className="w-full text-sm border border-line bg-white">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2">Time</th>
            <th className="p-2">Kind</th>
            <th className="p-2">CSI</th>
            <th className="p-2">Verdict</th>
            <th className="p-2">Summary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2 whitespace-nowrap">{r.at}</td>
              <td className="p-2">{r.kind}</td>
              <td className="p-2">{r.claimShiftIndex}</td>
              <td className="p-2">
                {r.beforeVerdict ?? "∅"} → {r.afterVerdict}
              </td>
              <td className="p-2">{r.summary}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td className="p-2" colSpan={5}>
                No shift events yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
