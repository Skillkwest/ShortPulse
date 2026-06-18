# 2026-06-17 Account auth boundary failure honesty

- Context: post-deploy Copperknot refresh confirmed production route parity is still blocked by exposed retired routes, so this pass stayed on a bounded source-hardening seam.
- Touched: `frontend/pages/api/account/email/update.ts`, `frontend/pages/api/account/profile/update.ts`, `frontend/pages/api/account/email/confirm.ts`, `frontend/tests/api/account-identity.test.ts`.
- Change: account identity routes now catch unexpected auth-verification throws, log route-owned diagnostics, and return existing safe account failure messages instead of escaping the route wrapper.
- Validation: `npm -C frontend run test -- --run tests/api/account-identity.test.ts tests/api/account.media-compliance.test.ts tests/pages/auth.callback.route-behavior.test.tsx tests/pages/profile.account-settings.test.tsx tests/pages/profile.route-state.test.tsx`; `npm -C frontend run type-check:touched`; `npm -C frontend run docs:check`; `git diff --check -- frontend/pages/api/account/email/update.ts frontend/pages/api/account/profile/update.ts frontend/pages/api/account/email/confirm.ts frontend/tests/api/account-identity.test.ts`.
- Boundary: no UI, UX, intended behavior, commit, push, deploy, or production-mutating proof.
