# Account Workspace Redesign Build Plan

Purpose: define the active implementation source for rebuilding `/profile` into a polished customer-facing account workspace without changing billing, security, launch, or branch posture.

Status: active
Owner/lane: Program 4, Workflows And Product Surfaces
Source request: current thread account-page redesign buildout request, June 8, 2026

## Objective

Rebuild `/profile` and its child sections into a cohesive customer account workspace where signed-in users can understand and safely manage their account identity, subscription, credits, storage, and transactions.

The redesign should make account state legible, put the next safe action near the relevant information, and preserve every existing account-management behavior currently covered by the profile route and billing/account API contracts.

## Approved Scope

In scope:

- `/profile` route layout, section navigation, and child-section presentation.
- Account child page: display name, email update, password reset, and media autosave preference.
- Subscription child page: current plan, plan changes, cancellation confirmation, Stripe portal handoff, and payment history presentation.
- Credits child page: current balance, renewal/incoming credit state, refresh action, credit packages, portal handoff, and recent activity presentation.
- Storage child page: usage/capacity state, active add-ons, add/remove controls, eligibility states, and storage payment history presentation.
- Transactions child page: unified billing feed and receipt/portal actions.
- Directly related `/profile` navigation links, route docs, tests, and profile-specific styles/components required to make the redesigned account workspace operational.
- Modular extraction from `frontend/pages/profile.tsx` when it directly reduces implementation risk or removes the profile route as a mixed controller/rendering file.

Out of scope:

- Billing plan prices, credit debit logic, storage entitlement logic, Stripe webhook behavior, Supabase schema/RLS, auth policy, launch posture, branch policy, commit/push/deploy work, and admin billing tools.
- New account child routes or new backend APIs.
- Broad dashboard, AI Studio, pricing-page, or global design-system redesigns beyond direct links into `/profile`.
- Fallback implementations, duplicate route authorities, backup style paths, or compatibility UI that bypasses the canonical profile implementation.

## Source Of Truth

Use these current repo sources while implementing:

- `AGENTS.md`, `docs/dev-ground-rules.md`, `docs/conventions.md`, and `docs/agent-playbook.md` for repo operating rules.
- `docs/ux-decision-framework.md` for account UX intent: trust, agency, momentum, and pricing legibility.
- `README.md` and `docs/routes.md` for route/account behavior contracts.
- `frontend/pages/profile.tsx` as the current canonical route behavior to preserve while extracting.
- `frontend/features/profile/` components, tests, and model helpers as the feature-owned implementation area.
- `frontend/styles/workspace-profile*.css` and `frontend/styles/profile-route.module.css` as the profile styling authority to consolidate.

## Target Layout

Use a customer account workspace pattern:

- Desktop: persistent left navigation, compact account summary header, content-first child section.
- Mobile: compact summary header with section navigation that behaves like top segmented navigation.
- Global account notices render in the content area directly under the summary header, not buried in the side rail.
- Each child page follows the same information pattern: section header, current-state summary, primary action area, secondary details/history.
- Use quiet SaaS/account styling, restrained cards, clear section hierarchy, Phosphor icons, and the existing ShortPulse plan palette.

## Child Page Intent

Account:

- Show identity and recovery controls clearly.
- Make display-name save, email change, password reset, and autosave preference feel separate but related.

Subscription:

- Explain current plan and renewal state first.
- Show plan-change actions with clear current/upgrade/downgrade/cancel states and existing confirmation behavior.
- Keep subscription payment history nearby.

Credits:

- Show usable credit state first.
- Keep refresh and top-up checkout actions close to the balance and package list.
- Keep recent credit activity visible below.

Storage:

- Show used vs included/add-on storage first.
- Show add-on actions only with their existing eligibility and management state.
- Keep recurring storage payment history nearby.

Transactions:

- Show unified billing history with receipt links and portal action.
- Preserve internally managed account empty/portal states.

## Implementation Batches

1. Stabilize the plan source and current route authority.
2. Extract or centralize profile route orchestration only where needed to keep the route maintainable.
3. Build shared profile UI primitives for shell, summary header, notice banner, section headers, metrics, action panels, and history lists.
4. Redesign the five child sections using the shared primitives while preserving existing props, handlers, endpoints, and tested text where behavior depends on it.
5. Fix directly related navigation/doc/test drift caused by the redesign.
6. Validate targeted profile behavior, then run lint/build when practical.

## Proof Requirements

Minimum proof before stopping:

- Targeted profile tests pass or any failures are explained with exact blocking cause.
- `npm -C frontend run lint` passes or remaining lint failures are proven pre-existing/out of scope.
- `npm -C frontend run build` passes or the build blocker is named and bounded.
- Docs checks run if route/navigation docs are changed.
- Final self-audit confirms no pricing/debit, storage entitlement, auth policy, branch, commit, push, deploy, or unrelated surface changes were introduced.

Manual/browser proof:

- Because the repo is in pre-launch mode, production-facing manual proof belongs on `https://www.shortpulse.ai` after deploy. Local tests and build can validate implementation details, but they do not prove deployed production behavior.

## Stop Conditions

Stop when:

- The `/profile` account workspace and all five child sections are rebuilt, operational, and validated against the proof requirements above.
- The next useful step would require backend billing/security/auth/Stripe/Supabase changes outside this plan.
- Required proof depends on commit, push, deploy, or production-release work outside this lane.
- Validation reveals a blocker that makes further autonomous UI work unsafe.
- Remaining work is mostly cosmetic churn or broader product redesign outside `/profile`.
