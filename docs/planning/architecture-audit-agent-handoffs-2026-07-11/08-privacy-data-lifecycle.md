# Next-Agent Handoff: Privacy Data Lifecycle

Lane id: `architecture-audit-08-privacy-data-lifecycle`

Status: design-first only. Initial assignment produces an approved architecture/operations packet; it does not execute customer export or erasure.

## Copy/Paste Assignment

Design the verified privacy-request lifecycle for access/export and deletion across ShortPulse, Supabase, storage, processors, and providers. Inventory every data class, retention duty, and deletion receipt. Do not perform bulk deletion or production mutation in this lane without a separate explicit authorization.

## Required Context

Read first:

- `AGENTS.md`, security checklist, privacy policy, terms, retention, storage, and account docs
- database schema, data dictionary, RLS, bucket policy, and processor/provider inventory
- account deletion and legal-acceptance implementations
- Lane 07 final voice deletion receipt contract
- applicable current privacy requirements from authoritative sources; label legal questions for counsel

Inspect first:

- all tables keyed directly or indirectly to user/account/project
- private storage buckets and generated/transient artifacts
- Stripe, email, AI provider, voice provider, logging, analytics, and support data
- auth identities, sessions, API keys/secrets, audit/security records, and backups
- current export/delete endpoints, jobs, and admin surfaces

## Confirmed Problems

- There is no single verified request case spanning identity proof, admission freeze, export, deletion, retention, and completion evidence.
- Provider/storage deletion obligations need durable per-system receipts.
- Auth deletion must occur last or orchestration/retry authority can be lost.
- Financial, security, abuse, and legal records may require documented retention or pseudonymization rather than blind deletion.
- Legal acceptance evidence needs a versioned, durable contract.

## Phase 1 Deliverables

- system-by-system data inventory with owner key, purpose, source, processor, retention, export, delete method, and evidence
- state machine for verified access/export and deletion requests
- admission freeze/session-revocation design for `deletion_pending`
- secure export packaging, expiry, and delivery design
- retention/pseudonymization matrix with reason, authority, expiry, and reviewer
- provider/storage receipt schema and retry policy
- final deletion manifest with Auth deletion last
- ADR, threat model, runbook, test plan, rollback/abort rules, and approval checklist

## Required State Contract

At minimum distinguish `requested`, `identity_pending`, `verified`, `export_building`, `export_ready`, `deletion_pending`, `deleting`, `partially_blocked`, `retained_with_basis`, `complete`, and `rejected`. Every transition must record actor, evidence, time, request identity, and reason.

## Avoid Surface

- do not execute a real request
- do not bulk-delete, anonymize, revoke, or export production customer data
- do not invent legal retention periods
- do not let individual providers silently define overall completion
- do not delete Auth identity before downstream work and receipts complete

## Acceptance Criteria For Phase 1

- Every known customer-data class appears in the inventory or an explicit unknowns list.
- Every external processor/provider has an export/delete/retention disposition.
- Partial failure is retryable and visible.
- Deletion admission prevents new billable/generation/storage work while preserving orchestration access.
- Retained records are minimized, pseudonymized where appropriate, and time/reason bounded.
- Completion is supported by a machine-readable final manifest.
- The implementation phase is split into reversible, testable increments.

## Validation And Proof

- Reconcile inventory against schema, code call sites, buckets, environment contracts, and provider clients.
- Threat-model identity fraud, export disclosure, race with new writes, replay, and partial deletion.
- Test the design with synthetic users only after approval.
- Separate legal assumptions from engineering facts and production evidence.

## Stop Rules

- Stop after the design packet unless the user explicitly authorizes implementation.
- Stop on any unknown data processor, retention duty, or irreversible step; record it as a named blocker.
- Never use a temporary data dump as the source of truth.

