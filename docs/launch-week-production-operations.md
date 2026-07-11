# Launch-Week Production Operations

Status: active as of `2026-07-07`.

ShortPulse officially launched on July 7, 2026. The repo is now in launch-week production operations: protect real customer use, investigate reported problems, watch for crashes and errors, and make small, evidence-backed source fixes that preserve intended UI, UX, and product behavior.

## Operating posture

- Work on local `production` only. GitHub work also targets `production`; do not use feature, staging, preview, or `main` branches unless the user explicitly changes this policy.
- Keep `git config --local shortpulse.allowedBranch` set to `production`.
- Treat `https://www.shortpulse.ai` as the browser/manual validation surface for customer-facing behavior. Local checks are implementation evidence, not production proof.
- Use the production Supabase project/database for operational investigation and approved production work. Do not use local Docker Supabase workflows or substitute local database state for production truth.
- Prioritize customer-reported bugs, crashes, error events, broken core workflows, data/credit/account trust issues, and evidence gaps that prevent correct triage.
- Make the smallest canonical source fix. Do not add fallbacks, duplicate paths, legacy behavior, or workaround layers merely to hide a production problem.
- Preserve current UI, UX, and intended behavior. Stop for user direction before a fix would materially change product semantics, visible workflow, pricing/credits, security/privacy posture, deployment/release state, or another agent's lane.

## Evidence and closeout

Follow `docs/agents/solo-owner-launch-trust-standard.md` for production-impacting claims. Separate local code/test proof, production-safe observation, and authenticated or mutating production proof. For an incident, identify the reported symptom, affected production surface, current evidence date, owning source boundary, fix or blocker, residual unknown, and next smallest proof. Do not declare a production issue resolved solely because a local check passed.

## Stop discipline

Stop when the current incident is fixed and appropriately proven, safely classified for its owner, or blocked by a named approval, release, or production-mutation boundary. Do not create extra launch paperwork or adjacent cleanup after the active customer-impact question is answered.
