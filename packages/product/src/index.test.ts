import { describe, expect, it } from "vitest";
import { can, defaultProductContext, entitlementsFor } from "./index.js";

describe("PARADOX product policy", () => {
  it("keeps personal access focused on the common-user experience", () => {
    const context = defaultProductContext("COMMON");
    expect(can(context, "VERIFY")).toBe(true);
    expect(can(context, "TEAM_WORKSPACE")).toBe(false);
    expect(can(context, "SSO")).toBe(false);
  });

  it("gives team analysts collaborative capabilities", () => {
    const context = defaultProductContext("ORGANIZATION");
    expect(can(context, "VERIFY")).toBe(true);
    expect(can(context, "TEAM_WORKSPACE")).toBe(true);
    expect(can(context, "API_ACCESS")).toBe(true);
    expect(entitlementsFor(context).has("SSO")).toBe(false);
  });

  it("restricts viewers to read-oriented capabilities", () => {
    const context = { surface: "ORGANIZATION" as const, plan: "TEAM" as const, role: "VIEWER" as const };
    expect(can(context, "HISTORY")).toBe(true);
    expect(can(context, "SHARED_REPORTS")).toBe(true);
    expect(can(context, "VERIFY")).toBe(false);
  });
});
