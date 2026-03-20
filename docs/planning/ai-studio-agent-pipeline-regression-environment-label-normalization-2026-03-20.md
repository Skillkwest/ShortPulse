# AI Studio Agent Prompt-Compiler Environment Label Normalization

Date: 2026-03-20  
Authority: Working  
Owner: Platform Ops + Engineering

## Purpose
Normalize environment label usage across remediation evidence packets and rollout templates.

## Canonical Labels
1. `local`: developer or operator local runtime validation.
2. `internal`: operator-only controlled ring in shared hosted environment.
3. `preview`: staging/preview deployment ring.
4. `production`: live traffic environment.

## Usage Rules
1. Phase planning docs may refer to `local/preview/production` for implementation validation.
2. Rollout docs may refer to `internal/preview/production` for ring-based operations.
3. When both patterns appear in one packet, include explicit mapping notes.

## Mapping Convention
1. `internal` is not synonymous with `local`; treat as hosted operator ring.
2. If a run uses local-only preflight instead of internal ring, record as `local (internal ring not exercised)`.

## Packet Requirement
All remediation evidence packets must include:
1. environment label(s) used,
2. mapping note if labels differ from canonical rollout ring terms.

