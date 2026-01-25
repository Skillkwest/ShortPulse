# Kling Video Text-to-Video API Reference

ShortPulse developers can reference this guide when working with Fal.ai's Kling Text-to-Video queue API (the newer v2.6 pro model plus the legacy v1.6 image-based variant). The document covers authentication, request lifecycle, schema options, and variant request bodies so you can orchestrate generation jobs in a sandbox-friendly way.

## Authentication

- **API key**: Set `FAL_KEY` in your runtime environment and pass it in every `Authorization: Key $FAL_KEY` header.
- **Security**: Never expose `FAL_KEY` to client-side code; use a secure backend proxy for submissions.

## Queue workflow

1. **Submit** the job:
   ```bash
response=$(curl --request POST \
  --url https://queue.fal.run/fal-ai/kling-video/v2.6/pro/text-to-video \
     --header "Authorization: Key $FAL_KEY" \
     --header "Content-Type: application/json" \
     --data '{
        "prompt": "A stylish woman walks down a Tokyo street..."
      }')
   REQUEST_ID=$(echo "$response" | grep -o '"request_id": *"[^"]*"' | sed 's/"request_id": *//; s/"//g')
   ```
2. **Poll** the queue status:
   ```bash
   curl --request GET \
     --url https://queue.fal.run/fal-ai/kling-video/requests/$REQUEST_ID/status \
     --header "Authorization: Key $FAL_KEY"
   ```
3. **Fetch the result** once the status reports completion:
   ```bash
   curl --request GET \
     --url https://queue.fal.run/fal-ai/kling-video/requests/$REQUEST_ID \
     --header "Authorization: Key $FAL_KEY"
   ```

‍Long-running requests should rely on queue polling or webhooks rather than blocking; the queue API encapsulates retries/status updates for you.

## Default schema (Text to Video v2.6 Pro)

- `prompt` (string, required): Scene description for the video.
- `duration` (`DurationEnum`): `"5"` or `"10"` seconds (API default `"5"`). ShortPulse defaults to `"10"` when invoking Kling 2.6 Pro text-to-video.
- `aspect_ratio` (`AspectRatioEnum`): `16:9`, `9:16`, or `1:1` (default `16:9`).
- `negative_prompt` (string): Defaults to `"blur, distort, and low quality"`.
- `cfg_scale` (float): Guidance strength (default `0.5`).
- `generate_audio` (boolean): Native audio is supported; ShortPulse sets this to `true` so the model emits English or translated voice by default (English/named glyphs should use lowercase for regular speech, uppercase for acronyms or proper nouns).

**Example request body**:
```json
{
  "prompt": "A stylish woman walks down a Tokyo street filled with warm glowing neon...",
  "duration": "10",
  "aspect_ratio": "16:9",
  "negative_prompt": "blur, distort, and low quality",
  "cfg_scale": 0.5,
  "generate_audio": true
}
```

**Typical response**:
```json
{
  "video": {
    "url": "https://v2.fal.media/files/..._output.mp4"
  }
}
```

## Image-to-Video (Kling 2.5 Turbo Pro)

- **Proxy submit**: `POST /api/fal/kling-v25-image-to-video-submit` with the payload below, which forwards to Fal.ai’s queue.
- **Fal queue**: `POST https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video`.

### Request schema

- `prompt` (string, required): Reference-free text describing the motion you want the video to capture.
- `image_url` (string, required): URL or data URI for the input image that will drive the animation.
- `duration` (`DurationEnum`): `"5"` or `"10"` seconds. ShortPulse sets `"10"` as the default output length.
- `aspect_ratio` (enum): `16:9`, `9:16`, or `1:1` (default `16:9`).
- `negative_prompt`: Defaults to `"blur, distort, and low quality"`.
- `cfg_scale`: Float guidance (default `0.5`).
- `tail_image_url` (string, optional): Image for the final frame.

### Example request

```json
{
  "prompt": "A racing car launches across a neon-lit city street.",
  "image_url": "https://example.com/reference.png",
  "duration": "10",
  "aspect_ratio": "16:9",
  "negative_prompt": "blur, distort, and low quality",
  "cfg_scale": 0.5
}
```

### Example response

```json
{
  "video": {
    "url": "https://storage.googleapis.com/falserverless/model_tests/kling/kling-v2.5-turbo-pro-image-to-video-output.mp4"
  }
}
```

## Status & callbacks

- Use `POST /api/fal/kling-v25-image-to-video-status` with `{ "requestId": "..." }` to poll the job.
- The proxy fetches `/requests/$REQUEST_ID/status` and, when done, `/requests/$REQUEST_ID` from Fal.ai.
- Responses include `status`, `taskId`, and the same `video.url` payload so ShortPulse can update the output card.

## Notes

- This flow requires a reference image before submission; the queue generates the video based on that image plus the prompt.
- Keep `FAL_KEY` server-side by routing both submit & status through the ShortPulse proxies.

## Variant request bodies

These variant objects expand Kling Video capabilities (image prompts, audio control, advanced camera, motion masks, voice control, etc.):

- `TextToVideoV21MasterRequest`, `TextToVideoV25ProRequest`, `TextToVideoV26ProRequest` (add audio generation controls, voice IDs, end image override).
- `ProImageToVideoRequest`, `KlingV15ProImageToVideoRequest`, `ImageToVideoV21/25/26 ProRequest`, `ImageToVideoRequest`, `ImageToVideoV2MasterRequest`, `ImageToVideoV21MasterRequest`, `V1ImageToVideoRequest`: Accept `image_url`, optional `tail_image_url`, `static_mask_url`, `dynamic_masks`, etc.
- `MultiImageToVideoRequest`: Supply up to 4 `input_image_urls`.
- `MotionControlRequest`: Combine `prompt`, `image_url` or `video_url`, and `character_orientation` (image/video).
- `VideoEffectsRequest`: Provide `input_image_urls` plus `effect_scene` (hug, pixel, celebration, etc.).
- `LipsyncA2VRequest`, `LipsyncT2VRequest`: For lip sync with provided video/audio URLs and voice parameters.
- Supporting objects include `FaceChoice`, `FaceData`, `CameraControl`, `DynamicMask`, `Trajectory`, `VoiceLanguageEnum`, `VoiceIdEnum`, each governing multi-modal controls and mixing audio/video timing.

## File inputs

- Accepts Base64 data URIs or publicly accessible URLs.
- Fal.ai provides hosted storage/Uploader (via client API) when needed; store URLs for reuse.
- Large uploads may incur performance penalties; prefer hosted URLs for high-res assets.

## Best practices

1. Use the queue endpoints (`submit`, `status`, `get result`) for every job to track progress instead of guessing when it's done.
2. Tag requests with metadata on your proxy layer (not via Fal.ai) so you can correlate queue results with ShortPulse features.
3. Cache the downloaded video URL or store it in Supabase once completed; avoid re-running the generation unless the prompt changes.
4. ShortPulse submissions default to `duration: 10s` and `generate_audio: true` for the Kling 2.6 Pro route, so downstream tooling can assume a single-second tier and include the audio track in previews.
