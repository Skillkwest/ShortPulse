# Architecture Decision Records (ADRs)

ADRs capture **important, durable decisions** so the repo stays coherent as it grows.

## When to write an ADR
- Introducing or removing a major dependency/tooling (e.g., test framework, state management).
- Changing architecture (e.g., client-only → backend, pages router → app router).
- New cross-cutting patterns (e.g., feature module conventions, data contracts).

## How to add one
1. Copy `TEMPLATE.md` to a new file: `NNNN-title-in-kebab-case.md`
2. Fill it out succinctly (1–2 pages is ideal).
3. Link it from `docs/README.md` if it changes how people work.

## Latest ADRs
- `docs/adr/0019-fal-modular-submit-retrieval-reliability.md`
- `docs/adr/0020-ai-studio-server-authoritative-runtime-v2.md`
- `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
- `docs/adr/0022-reference-grid-domain-modular-architecture.md`
- `docs/adr/0023-ai-studio-naming-canonicalization-and-alias-sunset-policy.md`
- `docs/adr/0024-ai-studio-agent-prompt-only-single-stage-runtime.md`
- `docs/adr/0025-ai-studio-create-startup-model-precedence.md`
- `docs/adr/0026-ai-studio-generation-admission-control.md`
