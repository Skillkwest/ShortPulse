# Message Feedback Normalization Plan

Purpose: provide the active implementation source for normalizing user-facing feedback messages across the ShortPulse frontend.

## Plan Source

- Original source: current Codex thread goal `019ea753-4cf7-76d0-ae4f-a040130c0509`, audited plan response dated 2026-06-08.
- Repo source of truth: this document plus current repo code, `AGENTS.md`, `docs/dev-ground-rules.md`, `docs/conventions.md`, `docs/agent-playbook.md`, `frontend/AGENTS.md`, `docs/frontend-architecture.md`, and `docs/styles-structure.md`.

## Objective

Create one repo-native feedback presentation system for user-facing non-blocking errors, warnings, information, success messages, banners, toasts, inline alerts, route notices, admin/operator warning panels, and legacy media-route notices.

## Owner And Lane

- Owner/lane: ShortPulse frontend UI implementation.
- Branch: local `production` only during the pre-launch phase.
- Runtime posture: local commands and tests may validate implementation, but this plan does not approve push, deploy, production mutation, or launch-readiness claims.

## Approved Scope

In scope:

- Shared frontend feedback component, hook, styles, tests, and directly required docs.
- Migration of audited user-facing message containers to the shared presentation system.
- Accessibility defaults for message role, live-region behavior, dismiss controls, CTAs, and stable layout.
- Existing message copy preserved unless a surface is clearly unsafe, overly raw, or already uses a sanctioned copy normalizer.

Out of scope:

- API-only error strings that are not directly rendered.
- Telemetry semantics or root-cause emitter behavior.
- Provider/domain copy-normalizer rewrites in `frontend/lib/customerFacingProviderText.ts`, `frontend/features/ai-studio/logic/mediaLibraryErrorText.ts`, `frontend/lib/authErrorMessages.ts`, and `frontend/lib/mediaStorageQuota.ts`.
- Replacing `frontend/components/ConfirmationModal.tsx` as the blocking dialog primitive.
- Branch, push, deploy, launch posture, security posture, broad visual redesign, or unrelated route/workflow changes.

## Implementation Batches

1. Inventory all current user-facing feedback surfaces and classify each hit as `migrate`, `copy-helper only`, `loading/status exempt`, or `non-user-facing exempt`.
2. Add the shared feedback primitive and styles.
3. Migrate the highest-risk seams first: AI Studio alert stack, Pulse preset status messages, Expert Edit transient toast, Media Library status area, and Profile route notice.
4. Migrate remaining audited app surfaces: auth/callback, pricing, report issue, compliance gate, AI Studio modals/panels, Character Manager, Elements Manager, Media Library legacy route, and admin/operator warning/error panels.
5. Remove or narrow obsolete per-surface message CSS after callsites migrate.
6. Add durable documentation for the new feedback UI convention.
7. Run targeted and broad validation, then rerun the inventory and close all unclassified hits.

## Proof Requirements

- Inventory grep exists in the final closeout and every remaining hit is migrated or explicitly exempted.
- Shared primitive has tests for tone, mode, accessibility defaults, dismissal, and optional CTA rendering.
- Migrated high-risk seams have targeted tests or an explicit proof gap when no practical test exists.
- Run `npm -C frontend run lint`, `npm -C frontend run type-check`, targeted Vitest specs for touched seams, and `npm -C frontend run build` if the CSS/component blast radius warrants it.

## Stop Condition

Stop when all in-scope inventory hits are migrated or explicitly exempted with proof. Stop earlier if the plan becomes contradictory, unsafe, stale, blocked by validation, requires push/deploy/production mutation, or the remaining work would mostly create churn instead of meaningful normalization.
