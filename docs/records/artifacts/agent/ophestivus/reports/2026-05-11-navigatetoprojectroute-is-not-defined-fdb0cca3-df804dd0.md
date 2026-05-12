# navigateToProjectRoute is not defined

- Created: 2026-05-11T02:08:58.298Z
- Status: complete
- Final board status: complete
- Finalized: 2026-05-11T14:39:13.414Z
- Ticket: fdb0cca3-4a5e-4aca-86e8-e444ebbf0563
- Incident: df804dd0-b095-4dc4-9aae-921ab4fa209d

## Summary

AI Studio project modal render crashed because the page runtime referenced an out-of-scope create-project callback.

## Changes

Moved project-modal callback ownership fully into useAiStudioShellRuntime, rewired the AI Studio page shell handoff, and added a project-modal boundary regression test.

## Validation

npm run test -- tests/pages/ai-studio.project-modal-boundary.test.ts tests/pages/ai-studio.character-mode.test.tsx; npx eslint pages/ai-studio.tsx tests/pages/ai-studio.project-modal-boundary.test.ts (2 pre-existing warnings in pages/ai-studio.tsx); git diff --check -- frontend/pages/ai-studio.tsx frontend/tests/pages/ai-studio.project-modal-boundary.test.ts

Verification class: tests-and-data-verified

Recurrence: 0 open same-fingerprint incidents; 0 fresh events after 2026-05-11T02:08:03.000Z.

## Residual Risk

monitor: Live browser route verification was not performed in this pass; watch localhost/dev AI Studio project-modal recurrence.
