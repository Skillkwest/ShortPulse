# 0101: Seedance Composition-Neutral Customer Pricing

## Status

Accepted for implementation; production rates and activation require separate approval.

## Supersedes

- ADR 0088 only where it treats Seedance video input as a customer billed-credit row or customer quantity dimension.

## Context

Seedance provider economics distinguish requests with and without video input. The with-video provider unit rate is lower, but provider quantity includes input-video plus output duration. Publishing those provider scenarios as customer rows caused the displayed quote and submit-time row to change when references were reconstructed, triggering ADR 0100 conflicts before generation.

The product contract is simpler: at the same model, resolution, and output duration, customer credits do not change when images, audio, video, or mixed assets are added. Provider economics and reference validation must remain input-sensitive.

## Decision

1. A policy-declared `seedance_composition_neutral_v1` profile publishes one customer billed-credit row per supported Seedance model and resolution.
2. The customer row omits `video_input` and uses `per_output_second`. Existing `per_second` semantics remain unchanged for legacy policies.
3. Profile absence means the legacy split contract, preserving active policy v9 and exact rollback behavior.
4. Raw input-video count and duration remain authoritative inputs for provider validation and modeled provider-cost/margin evidence, but never select or quantify the profile-bearing customer row.
5. Video references require positive aggregate duration evidence and remain capped at 15 seconds before reservation or provider dispatch.
6. A target migration dry-run must start from the exact active policy/custom rows, report collisions, five added and ten removed baseline Seedance customer rules, margin envelopes, and a deterministic artifact hash.
7. Activation requires the reviewed artifact hash and an expected active policy-version row id. The database compares that id under the canonical advisory lock.
8. The five customer rates are explicit admin-authored business decisions. No migration chooses a rate by asset composition, row order, or numeric maximum.

## Consequences

- Positive: customer quotes are stable across asset compositions; display and debit share one row; provider economics remain observable; legacy policy rollback remains exact.
- Negative: one normalized rate can subsidize long video-reference requests or raise non-video prices, so margin review is required before activation.
- Follow-up: approve the five rates from the reviewed production dry-run, apply the CAS migration, deploy dual-contract support, and activate only under the separate production boundary.

## Alternatives considered

- Remove video rows only from the UI: rejected because runtime still resolves split rows.
- Globally collapse Seedance variants: rejected because it silently reinterprets v9 and breaks rollback.
- Keep input-plus-output customer quantity: rejected because asset composition would still change customer price.
- Charge the maximum permitted provider total: rejected because it breaks duration proportionality and severely overprices short non-video requests.
