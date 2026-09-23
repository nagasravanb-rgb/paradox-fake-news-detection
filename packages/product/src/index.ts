export type ProductSurface = "COMMON" | "ORGANIZATION";
export type OrganizationRole = "OWNER" | "ADMIN" | "ANALYST" | "REVIEWER" | "VIEWER";
export type Plan = "PERSONAL" | "TEAM" | "ENTERPRISE";

export type Entitlement =
  | "VERIFY" | "RESEARCH" | "SITUATION" | "DECISION" | "MULTIMODAL"
  | "HISTORY" | "SHARED_REPORTS" | "TEAM_WORKSPACE" | "BULK_ANALYSIS"
  | "API_ACCESS" | "AUDIT_LOG" | "CUSTOM_POLICIES" | "RETENTION_CONTROLS"
  | "SSO" | "WEBHOOKS";

export interface ProductContext {
  surface: ProductSurface;
  plan: Plan;
  role?: OrganizationRole;
}

const COMMON = new Set<Entitlement>([
  "VERIFY", "RESEARCH", "SITUATION", "DECISION", "HISTORY", "SHARED_REPORTS"
]);

const TEAM = new Set<Entitlement>([
  ...COMMON, "MULTIMODAL", "TEAM_WORKSPACE", "BULK_ANALYSIS", "API_ACCESS", "AUDIT_LOG"
]);

const ENTERPRISE = new Set<Entitlement>([
  ...TEAM, "CUSTOM_POLICIES", "RETENTION_CONTROLS", "SSO", "WEBHOOKS"
]);

export function entitlementsFor(context: ProductContext): ReadonlySet<Entitlement> {
  if (context.surface === "COMMON" || context.plan === "PERSONAL") return COMMON;
  if (context.plan === "ENTERPRISE") return ENTERPRISE;
  return TEAM;
}

export function can(context: ProductContext, entitlement: Entitlement): boolean {
  if (context.surface === "ORGANIZATION" && context.role === "VIEWER") {
    return entitlement === "HISTORY" || entitlement === "SHARED_REPORTS";
  }
  if (context.surface === "ORGANIZATION" && context.role === "REVIEWER") {
    return !["CUSTOM_POLICIES", "RETENTION_CONTROLS", "SSO", "WEBHOOKS"].includes(entitlement);
  }
  return entitlementsFor(context).has(entitlement);
}

export function defaultProductContext(surface: ProductSurface): ProductContext {
  return surface === "COMMON"
    ? { surface, plan: "PERSONAL" }
    : { surface, plan: "TEAM", role: "ANALYST" };
}
