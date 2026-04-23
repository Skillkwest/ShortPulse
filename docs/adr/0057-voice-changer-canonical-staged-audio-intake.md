# ADR 0057: Voice Changer Canonical Staged-Audio Intake

## Status
Accepted

## Context

The Voice Changer workflow previously accepted local audio/video directly on the final
`/api/elevenlabs/speech-to-speech` route. That path left two problems:

1. Local video stayed staged as video in the UI even though the provider ultimately needs audio.
2. Large local uploads depended on multipart bodies reaching a Next/Vercel function, which is not
   the correct deployment posture for a Vercel-oriented runtime.

The feature requirement is stricter than a local patch:

- local development and deployed Vercel behavior must be the same,
- no rollout flags or environment-based behavior switches may control this lane,
- dropping a video must produce an extracted vocal sample before final generation.

## Decision

Adopt one canonical Voice Changer intake path:

1. Local source files are uploaded directly from the browser into private storage.
2. Video sources are converted into staged WAV audio through `POST /api/media/extract-audio`.
3. The Voices panel replaces the staged source with that derived audio asset before `Generate`
   becomes available.
4. Final conversion submits the staged audio reference (`sourceStoragePath`) to
   `/api/elevenlabs/speech-to-speech`.

Compatibility local multipart uploads remain accepted on `/api/elevenlabs/speech-to-speech` only as
fallback coverage for legacy callers, not as the primary product path.

## Consequences

- Local and deployed Voice Changer intake now share the same storage-backed architecture.
- Vercel body-size limits no longer define the primary Voice Changer source path.
- Video-drop UX now matches the actual provider contract by staging audio rather than raw video.
- The extraction runtime becomes an explicit application dependency; the repo now vendors
  `ffmpeg-static` instead of relying on a host-provided `ffmpeg` binary.
