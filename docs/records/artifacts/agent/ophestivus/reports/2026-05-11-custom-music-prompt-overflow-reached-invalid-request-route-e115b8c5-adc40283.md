# Custom music prompt overflow reached invalid request route

- Created: 2026-05-11T02:49:17.396Z
- Status: review-ready
- Ticket: e115b8c5-3f8b-41b0-8712-3ccdd3859f51
- Incident: adc40283-0dd5-4747-826c-8da27b0a6ca2

## Summary

AI Studio custom music mode allowed the combined prompt and lyrics payload to exceed the ElevenLabs music route's 800-character limit, so the client could submit a request the server would immediately reject as Invalid request.

## Changes

Updated MusicPropertiesPanel to validate the provider-facing combined custom music payload length before enabling generate, count the submission text instead of only the prompt in custom mode, and added regression coverage for the over-limit custom prompt path.

## Validation

npm run test -- features/ai-studio/components/__tests__/MusicPropertiesPanel.test.tsx; npx eslint features/ai-studio/components/MusicPropertiesPanel.tsx features/ai-studio/components/__tests__/MusicPropertiesPanel.test.tsx; git diff --check -- features/ai-studio/components/MusicPropertiesPanel.tsx features/ai-studio/components/__tests__/MusicPropertiesPanel.test.tsx

Verification class: tests-and-data-verified

Recurrence: 0 open same-fingerprint incidents; 0 fresh events after 2026-05-11T02:48:35.000Z.

## Residual Risk

monitor: Live browser-route verification was not performed in this pass; monitor for visible localhost music generation invalid-request recurrences until the custom composer path is exercised live again.
