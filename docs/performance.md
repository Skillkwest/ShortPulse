# Performance Operations Guide

Purpose: define operational expectations for frontend and generation-flow performance.

## Frontend performance guardrails

- Keep route entry points lean; push logic into feature modules.
- Avoid large synchronous computations in render paths.
- Keep AI Studio polling loops bounded and cleaned up on unmount.

## Generation workflow performance

- Enforce request payload limits before sending provider calls.
- Prefer URL-based media references over large inline payloads when possible.
- Keep polling intervals and timeout behavior consistent across providers.

## Validation checklist

- Run `npm -C frontend run build` and verify no blocking performance regressions.
- Smoke-test AI Studio generation across text/image/video modes.
- Confirm Media Library remains responsive with realistic item counts.

## AI Studio latency packet helpers

- Use `npm -C frontend run latency:ai-studio-inventory` before choosing a latency packet. It prints the static AI Studio API route inventory with protected-route and trigger hints.
- Use `npm -C frontend run latency:protected-route -- --path <route>` for direct protected API timing when a bearer token or Supabase bootstrap path is available.
- Use `npm -C frontend run latency:ai-studio-trace -- --project-id <uuid> --storage-state <path>` to capture a compact production AI Studio load trace with API timing. The default target is `https://www.shortpulse.ai`.
- Use `npm -C frontend run type-check:touched` after a packet when repo-wide `type-check` is noisy. It still runs the canonical TypeScript check, but fails only when diagnostics land in the touched frontend TypeScript files.

## Monitoring tie-in

- Track incident spikes related to timeout, fetch failure, and provider latency.
- Use `docs/monitoring.md` for triage and escalation workflow.
