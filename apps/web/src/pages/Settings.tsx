import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api("/api/v1/settings").then(setS).catch(() => setS(null));
  }, []);

  async function login() {
    try {
      const r = await api<{ token: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("paradox_token", r.token);
      setMsg("Token stored locally.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="max-w-xl text-sm space-y-4">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <pre className="border border-line p-3 bg-white">{JSON.stringify(s, null, 2)}</pre>
      <p>Secrets are never shown. Configure `.env` on the API host.</p>
      <div>
        <h3 className="font-medium">Login (when AUTH_REQUIRED=true)</h3>
        <input className="border border-line p-2 w-full mb-2" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border border-line p-2 w-full mb-2" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="border border-accent px-3 py-1" onClick={login}>
          Store JWT
        </button>
        {msg ? <p className="mt-2">{msg}</p> : null}
      </div>
    </div>
  );
}
