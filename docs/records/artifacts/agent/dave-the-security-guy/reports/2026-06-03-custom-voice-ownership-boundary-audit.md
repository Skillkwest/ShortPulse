# Custom Voice Ownership Boundary Audit

Owner: Dave the Security Guy
Date: 2026-06-03
Mode: launch-readiness security audit, no runtime code changes

## Decision

No confirmed critical/high custom-voice cross-user access issue was found in this pass.

The custom voice boundary is currently enforced by the intended canonical source:

- `public.user_owned_custom_voices` is the authoritative ownership ledger.
- Provider-global ElevenLabs inventory does not grant ownership for generated/cloned/custom voices.
- Legacy `user_preferences.ai_studio_saved_voices` may mirror metadata, but custom/provider-created voices must reconcile to a high-confidence ownership row before runtime access.

Stop condition reached for this lane: the remaining work would be speculative or adjacent unless fresh code, hosted SQL, or production evidence contradicts this audit.

## Threat Checked

Attacker path tested from repo evidence:

A signed-in user supplies or discovers another user's ElevenLabs custom `voiceId`, crossing the shared-provider voice boundary, causing unauthorized use or deletion of another user's custom voice through ShortPulse server routes.

## Surfaces Audited

- `frontend/lib/server/api/userSavedVoices.ts`
- `frontend/lib/server/elevenlabsVoiceLibrary.ts`
- `frontend/pages/api/elevenlabs/voices.ts`
- `frontend/pages/api/elevenlabs/voices/[voiceId].ts`
- `frontend/pages/api/elevenlabs/text-to-speech.ts`
- `frontend/pages/api/elevenlabs/speech-to-speech.ts`
- `frontend/pages/api/elevenlabs/text-to-voice/create.ts`
- `frontend/pages/api/elevenlabs/voices/clone.ts`
- `frontend/lib/server/elevenlabsCustomVoiceCleanup.ts`
- `sql/migrations/128_add_user_owned_custom_voices.sql`
- `sql/migrations/130_quarantine_legacy_migrated_custom_voice_ownership.sql`
- `docs/adr/0080-custom-voice-ownership-authority.md`
- `docs/security-checklist.md`

## Evidence

Confirmed controls:

- `listSavedVoicesForUser` reads both the legacy saved-voice cache and `user_owned_custom_voices`, but `mergeSavedVoices` suppresses legacy custom/provider-created rows unless they reconcile to the ownership ledger.
- `normalizeOwnedCustomVoice` only returns rows with `ownership_confidence = 'high'`; migrated/disputed rows are excluded from runtime authority.
- saved voice sample signing calls `assertUserScopedMediaStoragePath` before creating signed URLs.
- `resolveVoiceLibraryEntry` hides unowned provider voices unless they are shared/default provider catalog voices.
- `resolveVoiceAccessForUser` returns no access for hidden custom voices or fallback-only entries.
- `GET /api/elevenlabs/voices` builds the library from the caller's saved/owned voices plus filtered provider inventory.
- `DELETE /api/elevenlabs/voices/:voiceId` resolves the caller's effective voice inventory before deleting; unowned provider-created voices resolve as missing/protected and do not call provider delete.
- `/api/elevenlabs/text-to-speech` and `/api/elevenlabs/speech-to-speech` resolve voice access before billing or provider submission.
- text-to-voice create and clone routes persist provider-created voices with `originKind = 'provider-user-created'`, high-confidence ownership via `saveVoiceForUser`, and provider-delete eligibility; persistence failure triggers provider/sample cleanup.
- SQL migration `128` makes `user_owned_custom_voices` service-role-only for direct grants, adds user-scoped RLS policies, and enforces unique provider voice ownership.
- SQL migration `130` quarantines legacy-migrated rows by moving them to `ownership_confidence = 'disputed'`.

## Validation Run

Targeted tests passed:

```bash
npm -C frontend test -- --run tests/api/elevenlabs-voices.test.ts tests/api/elevenlabs-voice-delete-route.test.ts tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/api/elevenlabs-voice-clone-route.test.ts lib/server/api/__tests__/userSavedVoices.test.ts lib/server/__tests__/elevenlabsVoiceClone.test.ts lib/server/__tests__/mediaAudioExtraction.voiceClone.test.ts
```

Result: 8 files, 56 tests passed.

Important covered cases include:

- foreign provider-created custom voices are hidden from another user's voice library
- foreign custom voices are rejected before billing/provider submit
- unowned provider voices with missing ownership metadata are rejected
- provider delete is not called for unowned provider-created voices
- legacy custom voice preference rows do not grant live ownership without a matching high-confidence ledger row
- authoritative custom voice saves fail closed when the ownership table is unavailable
- create/clone routes clean up after ownership persistence failure

## Residual Risk

This pass did not run hosted Supabase SQL directly. The current source and tests prove the intended app-side boundary, while Nuclo's earlier production SQL proof reported the broader runtime SQL/security audit as passing. If future evidence shows hosted drift specifically in `user_owned_custom_voices`, rerun the hosted SQL security checks through the approved Supabase CLI/operator path.

## Next Highest-ROI Lane

Continue direct user-isolation checks on account-owned assets where normal users can trigger server work:

- media signing/listing paths
- billing portal/customer session paths
- credit reservation/debit ownership
- provider request IDs and result hydration
- project persistence restore/save authority
