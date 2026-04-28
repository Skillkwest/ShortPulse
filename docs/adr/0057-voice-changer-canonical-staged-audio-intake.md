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
2. Audio dragged from the Reference Grid or Quick Slot Inventory must resolve to either a durable
   storage/trusted media URL source or a same-session local `File` that is staged through the same
   local audio upload path; `blob:` and `data:` URLs are never submitted as final source media.
3. Video sources are converted into staged WAV audio through `POST /api/media/extract-audio`.
4. The Voices panel replaces the staged source with that derived audio asset before `Generate`
   becomes available.
5. Final conversion submits the staged audio reference (`sourceStoragePath`) to
   `/api/elevenlabs/speech-to-speech`.
6. When the staged audio was extracted from video, final conversion also remuxes the converted
   voice back onto the original video and publishes that remuxed clip as a sibling generated video
   output in AI Studio.

Compatibility local multipart uploads remain accepted on `/api/elevenlabs/speech-to-speech` only as
fallback coverage for legacy callers, not as the primary product path.

## Consequences

- Local and deployed Voice Changer intake now share the same storage-backed architecture.
- Vercel body-size limits no longer define the primary Voice Changer source path.
- Video-drop UX now matches the actual provider contract by staging audio rather than raw video.
- Video-derived Voice Changer runs now emit two durable AI Studio outputs: converted audio plus a
  remuxed sibling video that preserves the original clip visuals.
- The extraction runtime becomes an explicit application dependency; the repo now vendors
  `ffmpeg-static` instead of relying on a host-provided `ffmpeg` binary.
