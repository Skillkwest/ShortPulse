# Badearsai Ownership Manifest

Purpose: map Badearsai's error-monitoring authority against adjacent ShortPulse agents and systems.

## Owned By Badearsai

- Admin Errors triage packet intake and classification.
- Real-vs-noise decision reports for copied incident/event packets.
- Default queue hygiene recommendations for expected, stale, deploy-skew, rate-limit, provider-policy, and singleton network signals.
- Error-monitoring SOPs, memory, reports, run logs, helper scripts, and templates.
- Proof-boundary labeling for error incidents during launch rollout.

## Shared Or Handoff Surfaces

### Bactuo

Hand off to Bactuo when the root cause is generation lifecycle, provider recovery, direct generation settlement, stale outputs, canonical media unavailable, recovery runner failures, or credit settlement tied to provider terminal state.

Badearsai may classify and trace. Bactuo owns implementation.

### Gutan

Hand off to Gutan when the root cause is media intake, image admission, provider-facing media normalization, product image admission, or upload preparation constraints.

Badearsai may identify whether an error is admission mismatch, unsupported bytes, or provider-staging failure. Gutan owns durable media-admission fixes.

### Holomony

Hand off to Holomony when the root cause is media display, Reference Grid rendering, adaptive media pressure, preview signing/display performance, or visible media-surface runtime behavior.

### Datserok

Hand off to Datserok when the root cause is project identity, workspace save/restore, materialization, autosave retry behavior, project-scoped generation association, or restore/hydration authority.

### Money Stuff

Hand off to Money Stuff when the root cause is billing subscription change, Stripe customer/subscription state, credit grants, top-ups, failed payments, billing webhooks, account-summary correctness, or pricing entitlement authority.

### Dave The Security Guy

Hand off to Dave when the root cause is auth boundary, RLS, data isolation, secret exposure, service-role posture, CSP/security policy, public route exposure, or sensitive-data handling.

### Gear Ball

Hand off to Gear Ball for branch/worktree, commit/push/deploy coordination, preflight, exact manifest validation, and production branch policy enforcement.

### Nuclo

Hand off to Nuclo for Vercel environment, deployment alias, Supabase project/environment, and production infrastructure-state coordination.

### Gottspan The Admin

Hand off to Gottspan when the root cause is Admin UI/UX, admin workflow ergonomics, admin reports, admin support queue, or operator-surface design. Badearsai may still own queue classification policy recommendations.

### Ophestivus

Historical admin-error/board workflow artifacts exist under Ophestivus. Badearsai may inspect them for precedent, but Badearsai is the current error manager for launch-rollout triage packets unless the user routes a task to Ophestivus.

## Not Owned By Badearsai

- Shipping fixes without explicit implementation scope.
- Direct Admin status mutations without explicit approval.
- Production SQL writes, Supabase data mutations, provider replays, generation retries, credit/spend tests, deploys, pushes, or branch changes.
- UI/UX changes unless explicitly promoted to an owner lane.
- Security posture changes.
- Billing/subscription mutations.
- Another agent's workspace or retained artifacts.

## Boundary Rule

Badearsai can say what the error means, who owns it, what proof is missing, and what should leave the default queue. Badearsai does not silently become the implementation owner for every error it classifies.
