# PARADOX Product Modes

PARADOX should become one evidence-driven intelligence platform with two product surfaces.

## Personal — common people

**Job:** "I saw something. Help me understand whether it is supported, what the evidence says, and what remains uncertain."

Flow:
Paste / Share / Upload → Understand → Verify → Evidence → Follow-up → Save / Share

Default experience:
- Verify claims and articles
- Research topics
- Understand situations
- Compare decisions
- Plain-language explanations
- Evidence and source links
- Explicit uncertainty
- Personal history
- Shareable reports

Advanced trace, graph, calibration and provider details stay available without overwhelming the default experience.

## Organizations — companies and professional teams

**Job:** "Give our team a controlled, repeatable evidence workflow that can be audited, integrated and measured."

Workspace:
Organization → Workspace → Members/Roles → Projects/Cases → Evidence Library → Graphs → Policies → Audit Log

Roles:
- Owner: billing, members, workspace and policies
- Admin: workspace administration
- Analyst: run investigations
- Reviewer: inspect evidence, conflicts and reports
- Viewer: approved history and shared reports

Professional capabilities:
- Shared workspaces and evidence libraries
- Case-based investigations
- Bulk analysis
- API and webhooks
- Audit logs
- Retention controls
- Organization verification policies
- Provider/model configuration
- Evaluation and calibration dashboards
- Exportable reports
- Role-based access control
- Usage and cost observability
- Enterprise SSO

## Shared intelligence

Both surfaces use the same engines:

Verification: claim extraction → evidence retrieval → source analysis → contradiction/temporal analysis → self-verification → verdict.

Research: question decomposition → bounded retrieval → source relationships → findings → conflicts → uncertainty.

Situation: current state → actors → events → drivers → risks → scenarios.

Decision: objective → options → constraints → evidence → trade-offs → conditional outcomes.

## Architecture rule

Do not build two independent products or two independent intelligence stacks.

```
Shared Intelligence Core
        ↓
Product Policy / Entitlements
        ↓
Personal UX        Organization UX
```

The scientific/ML layer remains product-agnostic. Authentication, tenancy, permissions, billing, collaboration and UI belong above it.

## Organization case model

A professional investigation should become a durable case:

Case → claims/questions → inputs → executions → evidence → sources → contradictions → graph → reviewers → decisions → outcomes → audit events.

## Trust rules

1. Model output is never itself evidence.
2. Citations are never fabricated.
3. Preserve URL, retrieval time and provenance.
4. Separate evidence strength from model confidence.
5. Show uncertainty for incomplete/conflicting evidence.
6. Preserve temporal context.
7. Isolate organization data by tenant/workspace.
8. Audit privileged actions.
9. Automated assessments are not absolute truth claims.
10. Keep raw provider responses out of the default UX.

## Commercial boundary

Support Personal, Team and Enterprise plans without embedding billing rules into engine packages.

The product layer owns plan and entitlement policy; engine packages remain reusable.
