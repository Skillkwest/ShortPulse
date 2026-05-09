# Nuclo Training Memory

Purpose: retain non-authoritative training notes for Nuclo's environment and version management workflow.

## Current Training State

- Maturity: `Level 1: Supervised`.
- Contract created: 2026-05-08.
- First durable scope: branch ladder, Vercel environment wiring, Supabase project mapping, and promotion-path coordination.
- First known live blocker: Vercel credentials were unavailable in the shell during setup, so the repo-side live env audit could not complete.

## Guardrail Summary

- Do not mutate branches, deployments, Vercel envs, GitHub Environment secrets, or Supabase targets without explicit user approval.
- Treat branch, Vercel env, GitHub Environment, and Supabase project mapping as separate facts that must be proven and aligned.
- Keep secrets out of memory and reports.
- Keep `nuclo/` as a managed workspace, but not as source of truth.

## Notes

- Keep durable operating preferences in `docs/agents/nuclo/memory.md`.
- Keep run-specific evidence and lessons in this artifact namespace.
