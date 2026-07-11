# Next-Agent Handoff: CI, Tests, And API Boundaries

Lane id: `architecture-audit-13-ci-test-api-boundaries`

Status: foundation lane; execute in small phases with separate acceptance proof.

## Copy/Paste Assignment

Turn critical architecture contracts into blocking CI proof, make test environments intentional, and repair the highest-value dependency/API boundary defects. Do not launch a repository-wide layering rewrite or DTO conversion.

## Required Context

Read first:

- `AGENTS.md`, development ground rules, conventions, testing/CI docs, API conventions, and current workflow files
- current package scripts and repository contract checks

Inspect first:

- `.github/workflows/` and CI status checks
- Vitest configuration/projects and test environment annotations
- coverage configuration and critical-module test inventory
- authenticated non-spend browser smoke coverage
- database concurrency harnesses
- current runtime import cycles and server-to-UI feature imports
- high-churn API routes and malformed JSON handling

## Confirmed Problems

- Canonical architecture/contract checks need one blocking CI job rather than an untracked or duplicated command list.
- Node and jsdom tests need explicit environments to avoid accidental global behavior.
- Global coverage percentages would create noise; critical modules need targeted floors.
- Database race claims need executable concurrency harnesses.
- At least one runtime import cycle and server-to-UI feature inversion undermine boundaries.
- Malformed JSON should consistently return a controlled `400` instead of leaking framework errors.

## Owned Write Surface

- canonical blocking contract-check CI wiring
- Vitest node/jsdom project split or explicit environment rules
- critical-module coverage thresholds
- authenticated non-spend browser smoke workflow
- reusable database concurrency test harness
- named import cycle/server-feature inversion repairs
- shared validated DTOs for selected high-churn APIs and malformed-JSON handling

## Avoid Surface

- duplicating every package script in workflow YAML
- global coverage ratchet across the entire app
- converting all API routes or all feature folders at once
- spend-capable end-to-end tests
- broad dependency-direction rewrite without a named cycle or boundary defect

## Implementation Phases

1. Inventory current required checks and select one canonical local command.
2. Wire that command as a blocking CI job with clear failure output.
3. Separate Node/jsdom test environments and repair only revealed assumptions.
4. Add floors for critical billing, auth, generation, persistence, and deletion modules.
5. Add authenticated non-spend smoke and executable DB concurrency proof.
6. Fix the named cycle/inversion, then add a guard.
7. Standardize validated request/response DTOs on a small set of high-churn routes; add malformed JSON `400` handling.

## Acceptance Criteria

- Local and CI contract checks invoke the same canonical source.
- Test files run in their intended environment deterministically.
- Critical correctness modules cannot lose meaningful coverage unnoticed.
- Concurrency tests can reproduce and prove race invariants.
- The named runtime cycle/inversion is gone and guarded.
- Selected APIs reject malformed/unvalidated input predictably without changing successful responses.

## Validation And Proof

- Run the exact canonical CI command locally plus focused suites.
- Inspect workflow syntax and resulting required-check behavior; local YAML validation is not GitHub-run proof.
- Prove browser smoke is non-spend and production-safe before enabling it.
- Report any failures caused by unrelated dirty-tree work separately.

## Stop Rules

- Stop if workflow files are owned by another active batch.
- Do not weaken a check to make CI green.
- Do not create broad architecture churn to eliminate one concrete import violation.
- Stop before enabling a production-mutating smoke test.
