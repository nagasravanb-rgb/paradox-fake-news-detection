import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Membership = { role: string; organization: { id: string; name: string; slug: string; plan: string } };
type Me = { id: string; email: string; memberships: Membership[] };
type Organization = { id: string; name: string; slug: string; plan: string; workspaces: Array<{ id: string; name: string; slug: string }>; memberships: Array<{ id: string; userId: string; role: string }> };
type CaseItem = { id: string; title: string; description: string; status: string; updatedAt: string };

export function OrganizationWorkspace({ onExit }: { onExit: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadMe() {
    const value = await api<Me>("/api/v1/me");
    setMe(value);
    const first = value.memberships[0]?.organization;
    if (first) {
      const org = await api<Organization>("/api/v1/organizations/" + first.id);
      setOrganization(org);
      localStorage.setItem("paradox_organization_id", org.id);
      setCases(await api<CaseItem[]>("/api/v1/organizations/" + org.id + "/cases"));
    }
  }

  useEffect(() => { loadMe().catch((err) => setError(err instanceof Error ? err.message : "Sign in to use Organization mode.")); }, []);

  async function submitAuth(path: "/api/v1/auth/login" | "/api/v1/auth/register") {
    setBusy(true); setError("");
    try {
      const result = await api<{ token: string }>(path, { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("paradox_token", result.token);
      await loadMe();
    } catch (err) { setError(err instanceof Error ? err.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  async function createOrganization() {
    setBusy(true); setError("");
    try {
      const org = await api<Organization>("/api/v1/organizations", { method: "POST", body: JSON.stringify({ name: organizationName, slug: organizationSlug }) });
      setOrganization(org);
      localStorage.setItem("paradox_organization_id", org.id);
      setCases([]);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create organization."); }
    finally { setBusy(false); }
  }

  async function createCase() {
    if (!organization || !caseTitle.trim()) return;
    setBusy(true); setError("");
    try {
      const item = await api<CaseItem>("/api/v1/organizations/" + organization.id + "/cases", { method: "POST", body: JSON.stringify({ title: caseTitle, description: "" }) });
      setCases((current) => [item, ...current]); setCaseTitle("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create case."); }
    finally { setBusy(false); }
  }

  if (!me) return <section className="org-shell"><div className="org-hero"><div><span className="eyebrow">PARADOX Organizations</span><h1>Evidence operations for teams.</h1><p>Shared investigations, durable cases, governed access and an auditable evidence trail.</p></div><button className="secondary-button" onClick={onExit} type="button">Personal mode</button></div><div className="org-auth-card"><span className="eyebrow">Team access</span><h2>Sign in to your workspace</h2><div className="org-form"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" type="email" autoComplete="email" /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (10+ characters)" type="password" autoComplete="current-password" /><div className="org-form-actions"><button className="primary-button" disabled={busy} onClick={() => submitAuth("/api/v1/auth/login")} type="button">Sign in</button><button className="secondary-button" disabled={busy} onClick={() => submitAuth("/api/v1/auth/register")} type="button">Create account</button></div></div>{error && <div className="error-banner" role="alert"><strong>Workspace access</strong><span>{error}</span></div>}</div></section>;

  if (!organization) return <section className="org-shell"><div className="org-hero"><div><span className="eyebrow">Organization setup</span><h1>Create your team workspace.</h1><p>{me.email} is authenticated. Create an organization to start managing investigations.</p></div><button className="secondary-button" onClick={onExit} type="button">Personal mode</button></div><div className="org-auth-card"><div className="org-form"><input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Organization name" /><input value={organizationSlug} onChange={(e) => setOrganizationSlug(e.target.value)} placeholder="workspace-slug" /><button className="primary-button" disabled={busy} onClick={createOrganization} type="button">Create organization <span>→</span></button></div>{error && <div className="error-banner" role="alert"><strong>Setup needs attention</strong><span>{error}</span></div>}</div></section>;

  return <section className="org-shell"><div className="org-hero"><div><span className="eyebrow">Organization workspace · {organization.plan}</span><h1>{organization.name}</h1><p>Run evidence investigations as durable cases. Every organization resource is tenant-scoped and auditable.</p></div><button className="secondary-button" onClick={onExit} type="button">Personal mode</button></div><div className="org-metric-grid"><div className="org-metric"><span>Members</span><strong>{organization.memberships.length}</strong><small>Role-controlled access</small></div><div className="org-metric"><span>Workspaces</span><strong>{organization.workspaces.length}</strong><small>Isolated team spaces</small></div><div className="org-metric"><span>Cases</span><strong>{cases.length}</strong><small>Active investigations</small></div></div><div className="org-grid"><div className="org-card"><div className="section-heading"><div><span className="eyebrow">Investigation management</span><h2>Cases</h2></div></div><div className="org-case-create"><input value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} placeholder="New investigation case" /><button className="primary-button" disabled={busy || !caseTitle.trim()} onClick={createCase} type="button">Create</button></div>{!cases.length ? <div className="empty-state compact"><h3>No cases yet</h3><p>Create a case to turn an analysis into a durable professional investigation.</p></div> : <div className="org-case-list">{cases.map((item) => <article className="org-case" key={item.id}><div><span className="pill">{item.status}</span><h3>{item.title}</h3><small>Updated {new Date(item.updatedAt).toLocaleString()}</small></div><span>→</span></article>)}</div>}</div><div className="org-card"><span className="eyebrow">Governance</span><h2>Built for accountable evidence work.</h2><div className="org-feature-list"><span>✓ Role-based access</span><span>✓ Tenant-scoped cases</span><span>✓ Audit events</span><span>✓ Shared evidence foundation</span><span>✓ API-ready architecture</span><span>✓ Calibration and evaluation layer</span></div></div></div></section>;
}