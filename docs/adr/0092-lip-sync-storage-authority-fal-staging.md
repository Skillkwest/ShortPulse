# ADR 0092: Lip Sync Storage Authority For Fal Staging

- Date: 2026-06-10
- Status: Accepted
- Deciders: Frontend Engineering
- Related:
  - `docs/adr/0084-ai-studio-internal-media-ref-submit-authority.md`
  - `docs/sops/sop_video_generation.md`
  - `docs/api/api-fal-omnihuman-v1-5.md`

## Context

AI Studio Lip Sync submits the hidden Fal OmniHuman v1.5 provider with a
character `image_url` and voice `audio_url`. The UI could display selected
image/audio correctly while provider submit still failed because the submit path
treated signed/display URLs as durable input authority.

That repeated the stale-URL failure mode already addressed for image/edit refs
by ADR 0084. Lip Sync also has an audio-specific version of the problem: local
audio uploads and Media Library/Canvas drops can know an app-owned storage path,
but submit previously staged the display URL when preparing Fal CDN inputs.

## Decision

1. App-owned Lip Sync character image and voice audio inputs use storage/internal
   media identity as submit authority whenever that identity is known.
2. Signed URLs remain display/playback data for app-owned Lip Sync inputs; they
   must not outrank known storage paths during provider staging.
3. `/api/fal/upload-url` is the canonical Fal CDN staging helper for Lip Sync
   image/audio. It accepts caller-owned `media_library` storage paths for
   app-owned media and existing public `fileUrl` inputs only for URL-only media.
4. Local Lip Sync voice-audio files enter app-owned storage through the canonical
   `/api/media/prepare-upload` -> `/api/media/finalize-upload` Media Library upload path before submit-time Fal staging.
5. The Fal staging helper verifies the returned Fal CDN URL before returning
   success, so OmniHuman submit does not receive an unverified staged URL.
6. The Fal submit proxy enforces the same boundary before billing/provider
   dispatch: OmniHuman `image_url` and `audio_url` must be Fal CDN URLs.
7. Existing Fal CDN URLs are not accepted as final Lip Sync input authority.
   URL-only inputs are re-staged through `/api/fal/upload-url` with explicit
   image/audio `mediaKind`, so generic binary source responses become
   provider-compatible image/audio uploads when the path indicates the media
   type.
8. Lip Sync staging is timeout-bounded on both the client request and server
   Fal CDN initiate/upload legs. If staging cannot complete, the optimistic
   output must fail before provider submit instead of remaining pending without
   a provider request id.
9. Fal OmniHuman result settlement is model-aware. Echoed input fields such as
   `image_url` and `audio_url` are not generated media; only generated video
   fields may become Lip Sync output URLs.
10. UI/UX remains unchanged: Lip Sync still presents product-only controls,
    requires character image plus voice audio, and sends only provider-supported
    OmniHuman fields upstream.

## Consequences

Positive:

1. Lip Sync no longer depends on stale Supabase signed URLs when storage
   authority is available.
2. Media Library and Canvas audio drops preserve durable source identity through
   submit and reload.
3. Provider-facing `image_url` and `audio_url` stay derived, last-mile Fal CDN
   values.
4. Completed Lip Sync jobs cannot create image-copy result cards from provider
   input echoes.
5. Previously staged or provider-hosted URLs cannot bypass fresh Lip Sync
   staging.

Tradeoffs:

1. External URL-only media still uses the public URL staging branch because no
   app-owned storage authority exists.
2. `/api/fal/upload-url` now owns both URL and storage-path staging modes, so
   tests must cover both branches to prevent drift.

## Validation

This decision is implemented correctly only when:

1. Lip Sync submit stages app-owned image/audio by storage path when present.
2. Media Library and Canvas voice-audio drops keep storage path metadata.
3. `/api/fal/upload-url` rejects storage paths outside the caller namespace.
4. `/api/fal/upload-url` verifies returned Fal CDN URLs before success.
5. External URL-only media still stages through the existing public URL branch.
6. OmniHuman submit rejects non-Fal-CDN `image_url` or `audio_url` before
   billing/provider dispatch.
7. OmniHuman status/webhook settlement ignores input echoes and records only
   generated video URLs.
8. URL-only Lip Sync inputs include `mediaKind` during staging, and generic
   binary image/audio responses are uploaded to Fal CDN with media-compatible
   content types.
9. Fal CDN staging timeouts mark the optimistic output failed before provider
   submit, so there is no indefinite Reference Grid spinner without a provider
   request id.
