# Phase 4 Evidence: CI `npm ci` Transient Retry Hardening

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 4 (Guardrails + Governance)

## Scope
Reduce false-negative CI failures caused by transient dependency download issues while preserving strict enforce-mode gate behavior.

## Trigger
Run `22258999203` initially failed in `agent_disable_continuity` during `npm ci`:
- Supabase CLI postinstall checksum fetch returned `502 Bad Gateway or Proxy Error`.
- Failed-job rerun succeeded with no code changes, indicating transient infrastructure/network flake.

## Change
1. Added shared install wrapper:
   - `scripts/ci_npm_ci_with_retry.sh`
2. Updated `.github/workflows/ci.yml` npm-install steps to call wrapper:
   - `bash ../scripts/ci_npm_ci_with_retry.sh`
3. Retry policy:
   - Retries only on transient signatures (502/proxy/network/reset/timeout/corrupt-download patterns).
   - Fails fast for non-transient dependency/lockfile errors.
   - Cleans `node_modules` and npm cache between transient retries.

## Expected Effect
1. Preserve strict required-check semantics.
2. Reduce merge noise from upstream download instability.
3. Keep deterministic failures immediately actionable.
