# 2026-06-17 Launch Announcements Auth Boundary

- Selected lane: Admin and launch operations / public account trust, scoped to dashboard launch announcement read/publish/clear routes.
- Source changes: added route-owned unexpected auth failure logging to `frontend/pages/api/admin/announcements/{current,publish,clear}.ts` and `frontend/pages/api/announcements/active.ts`.
- Test changes: added auth-boundary assertions for publish, clear, and active announcement routes; added `frontend/tests/api/admin-announcements-current.test.ts` for current-announcement read/auth behavior.
- Validation: focused announcement cluster passed `18` tests; related announcement/access/offers slice passed `26` tests; `type-check:touched`, `docs:check`, and scoped `git diff --check` passed before this scratchpad.
- Proof boundary: local route/source tests only. No production announcement read/publish/clear mutation, commit, push, or deploy was performed.
