# 0100: Pricing-Policy Submit Handshake

## Status

Accepted

## Context

ADR 0088 makes the active admin-priced variant row authoritative for both customer display and debit. A long-lived AI Studio tab can retain an older policy snapshot while the server correctly resolves the newest active policy for each submission. Without a version handshake, the UI can show one price and the server can reserve another.

## Decision

Customer-facing billable AI Studio image, video, and audio submissions must carry the policy version and billed-credit amount used for the visible price. Variant-backed image and video submissions also carry the displayed variant identifier when available.

`chargeGenerationRequest` is the canonical enforcement boundary. After resolving the active policy and exact canonical variant, but before creating a reservation or calling a provider, it compares the submitted evidence with the active server result. Missing version evidence or any version, billed-credit, or supplied-variant mismatch returns HTTP 409 with a structured pricing conflict. The rejected attempt creates no reservation and must not be retried automatically.

The client removes its optimistic placeholder, requests a fresh policy snapshot, preserves the user's prompt and settings, and asks the user to review the new price and explicitly click Generate again.

Server-owned workflow classification determines which submissions require evidence. Client-supplied display-source labels are observability only and cannot disable enforcement.

## Scope

- Canonical Create and Edit image pricing lanes
- Canonical video pricing lanes
- Music, sound effects, voiceover, and voice changer pricing lanes
- Admin pricing observability and generation-trace version/variant fields

The separately billed style-preview endpoint is not changed by this decision because it does not currently expose a customer-visible per-submit price. Bringing that surface under ADR 0088 requires its own product/UI decision.

## Consequences

- A policy activation cannot silently change the debit beneath an already displayed price.
- Old tabs receive a review-and-resubmit interruption instead of an automatic charged retry.
- Reservation and ledger copies are grouped by `source_ref` when admin diagnostics report affected runs; raw row coverage remains visible separately.
- Local tests can prove rejection happens before reservation. Production proof still requires deployment followed by a non-spend conflict probe or an explicitly approved paid run.
