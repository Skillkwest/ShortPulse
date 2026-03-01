# Kie.ai Kling 3.0 (Dark-Path Contract)

This document tracks the internal ShortPulse dark-path contract for `kie-ai/kling-3.0`.

## Scope
- Provider: `kie`
- Model id: `kie-ai/kling-3.0`
- Canonical source reference: `https://docs.kie.ai/`
- Runtime status: dark path only (not user-selectable, not cutover-enabled)

## Current Runtime Contract (Pre-Cutover)
- Submit aspect field: `aspect_ratio`
- Allowed aspects: `16:9`, `9:16`, `1:1`
- Allowed durations: `5`, `10` (seconds)
- Expected payload fields:
  - required: `prompt`
  - optional: `duration`, `generate_audio`, `cfg_scale`

## Guardrails
1. Kie integration remains disabled by default.
2. Kie paths fail closed unless model is explicitly allowlisted.
3. Public `/api/fal/*` routes remain unchanged.

## Follow-up Required Before Enabling
1. Capture primary-source Kie contract details for this model just-in-time.
2. Confirm status/result payload shape parity in provider integration tests.
3. Re-validate pricing assumptions before any production enablement.
