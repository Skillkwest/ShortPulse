# 2026-06-17 OpenAI Direct Generation Auth Boundary

- Selected lane: Create/Edit workflow plus credits/generation runtime, scoped to direct GPT Image 2 create/edit API entry points.
- Source changes: added route-owned unexpected auth failure logging to `frontend/pages/api/openai/image-generate.ts` and `frontend/pages/api/openai/image-edit.ts` before billing, media-ref resolution, provider dispatch, or persistence.
- Test changes: added auth-boundary invariants to `frontend/tests/api/openai-image-generate.test.ts` and `frontend/tests/api/openai-image-edit.test.ts`; refreshed stale unsupported-size fixtures from now-valid `2048x2048` to unsupported `4096x4096`.
- Validation: focused OpenAI route slice passed `15` tests; related route/billing reservation slice passed `40` tests; `type-check:touched`, `docs:check`, and scoped `git diff --check` passed before this scratchpad.
- Caveat: generation billing reservation tests intentionally print fail-closed stderr fixtures for simulated RPC failures.
- Proof boundary: local source/testing only. No production generation, credit spend, provider call, commit, push, or deploy was performed.
