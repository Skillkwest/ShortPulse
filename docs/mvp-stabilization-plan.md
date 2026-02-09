---
title: MVP Stabilization Plan
status: Draft
owner: Product + Engineering
last_updated: 2026-02-05
---

# MVP Stabilization Plan

Purpose: Provide a procedural, single-source runbook to align the repo with the current MVP scope and execute the work in a controlled sequence without scope creep.

## Phase Status (Current)
- Phase 0: Complete
- Phase 1: Implemented (manual verification pending)
- Phase 2: Pending
- Phase 3: Pending
- Phase 4: Pending

## MVP Scope (Lock These)

### In Scope (MVP)
- AI Studio: core create flows (text, image, video), reference grid, prompt/describe flows, cost/credit display, and error handling.
- Dashboard: solid, polished, functional workspace hub.
- Profile: account settings + billing information; reliable auth and session flows.
- Credits & Pricing: correct model pricing, accurate cost display, and reliable debit behavior.

### Out of Scope (Post‑MVP)
- Saved Creators list (feature deferred; keep “Coming Soon” messaging).
- Performance Analytics (feature deferred; keep “Coming Soon” messaging).

### Coming Soon Requirements
- Any deferred surface must display clear “Coming Soon” banners and remove MVP‑blocking expectations from checklists.

## Non‑Negotiables (MVP Quality Bar)
- Pricing accuracy: `modelRegistry` + `pricing` + debit logic align with UI cost display.
- Credit debits are correct, consistent, and logged.
- Auth/session reliability on protected routes.
- AI Studio’s core create flow is stable end‑to‑end.
- Dashboard/Profile polish meets production expectations (layout, copy, error states).

## Phase 0: Doc & Rules Alignment (Must Happen First)
Goal: prevent process drift and make MVP scope explicit across docs and checklists.

Checklist:
1. Update `README.md` and `docs/routes.md` to reflect MVP scope and “Coming Soon” notes for deferred features.
2. Update `docs/release-checklist.md` to remove Saved Creators and Performance from required MVP checks.
3. Ensure `/admin` is either documented in `docs/routes.md` (if intended) or removed (if not).
4. Update `docs/styles-structure.md` to reflect actual CSS file split.
5. Update `docs/README.md` to include missing docs (including this file, `docs/AGENTS.md`, and `docs/known-issues.md`).
6. Remove stale references from SOPs (e.g., deprecated docs).
7. Clarify that the ~500‑line file guideline is advisory, not blocking.
8. Reconcile `docs/testing-guide.md` with the actual test situation (if tests exist but no harness, say so).
9. Move any buried design rules (e.g., palette constraints) into the appropriate design/style doc so they are discoverable.

Acceptance criteria:
- Docs match the MVP scope and don’t require post‑MVP features.
- Routes and checklists are in sync with actual pages.

## Phase 1: Credits & Pricing Verification
Goal: guarantee cost visibility and debits are correct.

Checklist:
1. Verify `modelRegistry` defaults match SOP tables and UI.
2. Verify `pricing.ts` and `pricingStrategies.ts` match actual model pricing.
3. Validate server-authoritative charging for image/video runs and confirm text/describe calls remain usage-only (no credit debit).
4. Confirm UI cost display matches computed cost (before and after run).
5. Add a manual verification checklist for credits in `docs/release-checklist.md`.

Acceptance criteria:
- Pricing display and debits are consistent across AI Studio flows.
- Any mismatches are documented and resolved.

## Phase 2: Dashboard + Profile Polish
Goal: make dashboard and profile “production‑ready” for MVP.

Checklist:
1. Confirm dashboard layout consistency, states, and CTA reliability.
2. Validate profile flows: account info, billing info, logout, and error handling.
3. Ensure copy and empty states are polished and consistent.

Acceptance criteria:
- Dashboard and Profile pass manual UX and functional checks.

## Phase 3: AI Studio Stabilization
Goal: stabilize the core AI Studio creation loop.

Checklist:
1. Validate prompt → generate → result flow for text/image/video.
2. Ensure reference grid drag/drop and preview behavior is stable.
3. Confirm error banners and fallback behaviors are visible and clear.
4. Ensure prompt/describe flows align with the SOPs and prompt config source of truth.

Acceptance criteria:
- AI Studio core flows are stable with consistent error handling.

## Phase 4: MVP Release Readiness
Goal: verify MVP readiness without post‑MVP dependencies.

Checklist:
1. Run lint/build checks.
2. Complete the MVP manual smoke list (auth, AI Studio, dashboard, profile).
3. Confirm “Coming Soon” surfaces are present and not blocking.
4. Ensure docs and route map reflect final MVP scope.

Acceptance criteria:
- Release checklist passes with no post‑MVP features required.

## Risks & Deferred Work (Post‑MVP)
- Saved Creators: full CRUD + RLS + UX polish.
- Performance Analytics: data actions rail, filtering, scoring, charts.
- Additional admin tooling and operator dashboards.

## Ownership & Updates
- Keep this plan updated if MVP scope changes.
- Add a short note to `docs/change_log.md` when a phase completes.
