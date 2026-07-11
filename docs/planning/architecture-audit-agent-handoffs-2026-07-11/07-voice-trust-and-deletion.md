# Next-Agent Handoff: Voice Trust And Deletion

Lane id: `architecture-audit-07-voice-trust-and-deletion`

Status: narrow, high-ROI lane; may run after exact overlap inspection.

## Copy/Paste Assignment

Move voice-clone consent from a browser assertion to a server-verifiable, versioned attestation and make custom-voice deletion converge across provider, storage, and ownership records. Do not redesign the voice product.

## Required Context

Read first:

- `AGENTS.md` and startup spine
- current voice cloning, storage, security, privacy, and account-deletion docs
- provider documentation for voice creation/deletion and idempotency semantics

Inspect first:

- custom-voice creation and deletion API routes
- provider voice client/services
- voice sample upload/storage paths
- voice ownership tables, migrations, RLS, and cleanup jobs
- current consent UI and request payload
- tests covering clone, ownership, storage, and deletion

## Confirmed Problems

- Consent may be represented only by a client-provided boolean rather than durable server evidence.
- Deletion spans provider state, stored sample media, and ownership rows without one convergent receipt/tombstone contract.
- Current voice sample artifacts can become orphaned when one deletion step fails.
- A provider `404` or missing storage object must converge safely, not strand the request forever.

## Owned Write Surface

- server-side versioned consent attestation at clone mutation
- voice deletion tombstone/state machine and retry worker
- provider and storage deletion adapters
- final deletion receipt consumed by Lane 08
- focused route/provider/storage/ownership tests
- required schema, RLS, ADR/SOP, and data dictionary updates

## Avoid Surface

- general media-library deletion, owned by Lane 10
- complete-account erasure orchestration, owned by Lane 08
- voice UX redesign, new providers, or model-quality changes
- deletion of customer data during implementation testing

## Required Contract

1. Clone mutation records user id, attestation version, policy text/version reference, timestamp, request identity, and target/source identifiers server-side.
2. A client checkbox alone is not the audit record.
3. Delete creates an idempotent tombstone before external calls.
4. Provider deletion and sample-storage deletion are independently retryable.
5. Provider `404` and missing object are successful terminal evidence when identity matches.
6. Ownership rows are removed or irreversibly finalized only after required deletion proof exists.
7. The final receipt names completed, already-absent, failed, retained, and retryable components.

## Required Failure Tests

- duplicate clone mutation with one request identity
- delete repeated before, during, and after completion
- provider deleted but storage fails; storage deleted but provider times out
- provider `404`, missing storage object, and mismatched provider identity
- worker crash between each state transition

## Acceptance Criteria

- Every new custom voice has durable versioned consent evidence.
- No successful delete response leaves an untracked provider or sample cleanup obligation.
- Retries converge without resurrecting ownership or duplicating side effects.
- Lane 08 can consume one explicit voice-deletion receipt.

## Validation And Proof

- Run focused route/service/provider/storage/RLS tests.
- Use provider fixtures or a non-destructive test resource; do not spend or delete production assets without approval.
- For schema changes, follow Lane 00 and verify hosted readback separately.
- Production closure requires authorized evidence from a purpose-created test voice, not a customer voice.

## Stop Rules

- Never delete an existing customer voice for validation.
- Stop before provider mutation, hosted SQL, or deploy without authority.
- Do not report completion while any required component remains only best-effort.

