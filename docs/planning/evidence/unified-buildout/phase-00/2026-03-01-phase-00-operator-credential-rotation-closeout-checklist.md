# Phase 00 Operator Closeout Checklist: Credential Rotation Evidence

Date: 2026-03-01  
Owner: Environment Operators + Engineering Review  
Status: Deferred (operator window pending)

## Purpose
Close the remaining Phase 00 operational blocker by collecting concrete credential-rotation evidence.

## Required Provider Surfaces
1. Supabase project keys/tokens used by runtime automation.
2. Fal provider key (`FAL_KEY`) and any related webhook secrets.
3. OpenAI API keys used by server routes.
4. Vercel environment variables and deploy-token surfaces used by CI/runtime.

## Operator Steps
1. Rotate keys/secrets in each provider console.
2. Revoke old credentials immediately after replacement.
3. Update active runtime environment values in deployment targets.
4. Verify the app still boots and required server routes authenticate upstream calls.

## Evidence To Attach
1. Rotation timestamp (UTC) per provider.
2. Confirmation that old key/token was revoked.
3. Environment target list updated (prod/staging/dev as applicable).
4. Validation command summary after rotation:
   - `npm -C frontend run type-check`
   - `npm -C frontend run lint`
   - `npm -C frontend run build`

## Closeout Update Targets
1. `docs/planning/shortpulse-unified-buildout-tracker.md` (Phase 00 note -> complete).
2. `docs/planning/stages/unified-phase-00-baseline-stabilization-and-incident-hygiene.md`.
3. `docs/change_log.md`.
