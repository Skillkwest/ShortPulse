# Kling Video Text-to-Video API Reference

ShortPulse developers can reference this guide when working with Fal.ai's Kling Text-to-Video models (v1.6 and related variants) via the queue API. The document covers authentication, request lifecycle, schema options, and variant request bodies so you can orchestrate generation jobs in a sandbox-friendly way.

## Authentication

- **API key**: Set `FAL_KEY` in your runtime environment and pass it in every `Authorization: Key $FAL_KEY` header.
- **Security**: Never expose `FAL_KEY` to client-side code; use a secure backend proxy for submissions.

## Queue workflow

1. **Submit** the job:
   ```bash
   response=$(curl --request POST \
     --url https://queue.fal.run/fal-ai/kling-video/v1.6/pro/text-to-video \
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

## Default schema (Text to Video v1.6 / pro)

- `prompt` (string, required): Scene description for the video.
- `duration` (`DurationEnum`): `"5"` or `"10"` seconds (default `"5"`).
- `aspect_ratio` (`AspectRatioEnum`): `16:9`, `9:16`, or `1:1` (default `16:9`).
- `negative_prompt` (string): Defaults to `"blur, distort, and low quality"`.
- `cfg_scale` (float): Guidance strength (default `0.5`).

**Example request body**:
```json
{
  "prompt": "A stylish woman walks down a Tokyo street filled with warm glowing neon...",
  "duration": "5",
  "aspect_ratio": "16:9",
  "negative_prompt": "blur, distort, and low quality",
  "cfg_scale": 0.5
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
