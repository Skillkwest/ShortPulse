# Generation Pipeline Rebuild Lane 3 Cutover Gates (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

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
