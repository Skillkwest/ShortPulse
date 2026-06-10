# Fal OmniHuman v1.5 API Reference

Internal API reference for the hidden AI Studio Video Lip Sync provider model.
This provider/model name must not appear in customer-facing AI Studio UI.

## ShortPulse Runtime

- Internal model id: `fal-ai/bytedance/omnihuman/v1.5`
- AI Studio mode: Video -> Lip Sync
- Runtime route slug: `omnihuman-v15`
- Submit wrapper: `frontend/pages/api/fal/omnihuman-v15-submit.ts`
- Status wrapper: `frontend/pages/api/fal/omnihuman-v15-status.ts`
- Submission adapter key: `fal-omnihuman-v15`
- Pricing: `$0.16` per audio/output second through shared model pricing policy

## Provider Contract

- Submit: `POST https://queue.fal.run/fal-ai/bytedance/omnihuman/v1.5`
- Status: `GET https://queue.fal.run/fal-ai/bytedance/requests/$REQUEST_ID/status`
- Result: `GET https://queue.fal.run/fal-ai/bytedance/requests/$REQUEST_ID`
- Auth: `FAL_KEY`, server-side only

Required upstream fields:

- `image_url`
- `audio_url`

Optional upstream fields:

- `prompt`
- `mask_url`
- `turbo_mode`
- `resolution`

Allowed resolutions:

- `720p`
- `1080p`

Output:

- `video.url`
- `duration` when returned by provider

## ShortPulse Defaults And Guardrails

- The product surface labels this workflow `Lip Sync`.
- The Video panel requires one character image and one voice audio clip.
- Prompt text is optional.
- `1080p` accepts voice audio under `30s`.
- `720p` accepts voice audio under `60s`.
- ShortPulse blocks known over-limit audio before provider submit.
- The Lip Sync submit adapter stages both the selected character image and voice audio through `/api/fal/upload-url`; upstream `image_url` and `audio_url` should be Fal CDN URLs, not Kie temporary upload URLs.
- Billing duration is carried in `shortpulse_context`; duration is not sent as an upstream provider field.
- Generated wrapper routes strip ShortPulse sidecars before provider submit.
