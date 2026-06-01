> Archived 2026-06-01 during planning cleanup. Reason: superseded rebuild-era contract packet that is no longer in the active planning reading path; retained as historical generation-pipeline rebuild context, not active planning authority.

# Generation Pipeline Rebuild Lane 3 Cutover Gates (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose

This document defines the cutover gates for Lane 3 delivery and read-model work.

Lane 3 must not become a broad UI rewrite. It is a controlled authority cutover.

## Core Rule

Lane 3 may only move surfaces from compatibility reads to canonical output and storage authority.

It may not:

1. redesign Reference Grid layout
2. broaden into unrelated Media Library refactors
3. change drag/drop payload shape without an explicit downstream contract update

## Required Protected Surfaces

Before any broad Reference Grid cutover, these reuse surfaces must have explicit contract coverage:

1. AI Studio Reference Grid drag/drop
2. Character library ingestion
3. Style library ingestion
4. Media library save/reuse flows
5. Generated download/export flows
6. Internal reference resolution for generated outputs

## Authority Cutover Order

Lane 3 should cut over in this order:

1. server-backed generated download/export resolution
2. internal generated reference resolution
3. action gating and drag/drop authority
4. Reference Grid read derivations
5. broader card/detail/render classification

The order matters because downstream consumers depend on drag/drop and reference payload stability.

## Current Entry Target

Lane 3 should open with the preview/detail derivation layer, not a broad grid rewrite.

The first bounded surface is:

1. `frontend/features/ai-studio/hooks/useAiStudioPreviewDetailProps.ts`
2. `frontend/features/ai-studio/hooks/useAiStudioOutputDerivations.ts`
3. `frontend/features/ai-studio/components/DetailModal.tsx`

Reason:

1. this path still promotes raw `previewUrl` plus readiness flags as if they were durable authority
2. it is safer than broad Reference Grid or drag/drop cutover
3. it can be regression-tested without changing downstream payload contracts

Initial cutover objective:

1. preview/detail should use canonical output/storage authority first
2. preview-only generated outputs may remain viewable
3. preview/detail should not imply durable reusability or saved authority when only transient preview state exists

Current checkpoint:

1. active-output preview authority now resolves through canonical preview/storage preference in `useAiStudioState.ts` and `useAiStudioPreviewDetailProps.ts`
2. detail-modal media derivation now keeps canonical preview/full authority ahead of transient preview URLs
3. regression coverage exists for preview hook gating, preview-authority preference, and detail-modal canonical preview/full preference
4. the next remaining seam would move closer to broader Reference Grid behavior, so it should not be opened casually

Pause decision:

1. Lane 3 is intentionally paused at this checkpoint.
2. The current scoped job stops here rather than widening into broader grid, drag/drop, or reuse cutover by sequence alone.
3. Lane 3 should reopen only under a new explicit objective with regression protection for the affected downstream surfaces.

## Required Cutover Gates

No surface may move to canonical-only authority unless:

1. canonical output coverage is sufficient for that surface's historical rows
2. targeted regression tests exist for:
   - save
   - download
   - drag/drop
   - reference reuse
3. compatibility fallback posture is explicit:
   - still allowed temporarily
   - or intentionally fail-closed

## Feature Flag And Rollout Decision

Lane 3 must explicitly decide, before broad cutover:

1. whether surface cutovers need a runtime flag
2. whether cutover is per-surface or all-at-once
3. what rollback signal returns the surface to compatibility reads

## Exit Gate

Lane 3 is complete only when:

1. generated output delivery and reuse are driven by canonical outputs and storage-backed media
2. downstream drag/drop consumers are not relying on legacy provider-url authority
3. any remaining compatibility fallback is narrow, explicit, and temporary
