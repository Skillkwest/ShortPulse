# Fal.ai Kling 3.0 Pro Image-to-Video API Reference

Use this guide to submit and poll Kling 3.0 Pro image-to-video jobs via the Fal queue (`fal-ai/kling-video/v3/pro/image-to-video`). ShortPulse proxies these requests through Next API routes to keep `FAL_KEY` server-side.

## Authentication

- **API key**: Set `FAL_KEY` in your runtime environment and pass it via `Authorization: Key $FAL_KEY`.
- **Security**: Never expose `FAL_KEY` in client-side code; use the ShortPulse proxy endpoints below.

## Queue workflow

1. **Submit** the job via the ShortPulse proxy:
   - `POST /api/fal/kling-v3-image-to-video-submit`
2. **Poll** for status:
   - `POST /api/fal/kling-v3-image-to-video-status` with `{ "requestId": "..." }`
3. **Fetch result**: the status proxy automatically fetches the result once the queue reports completion.

## Fal queue endpoints (for reference)

- Submit: `POST https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video`
- Status: `GET https://queue.fal.run/fal-ai/kling-video/requests/$REQUEST_ID/status`
- Result: `GET https://queue.fal.run/fal-ai/kling-video/requests/$REQUEST_ID`

## Request schema (subset used by ShortPulse)

- `prompt` (string, required): The text prompt for the video generation.
- `start_image_url` (string, required): URL of the image to be used as the starting frame.
- `end_image_url` (string, optional): URL of the end frame. Used when ShortPulse is in **keyframes mode** or **kling3 mode**. Unlike Veo 3.1 First/Last Frame which requires both frames, Kling 3.0 treats the end frame as optional.
- `duration` (number): Duration in seconds. Allowed enum values: 3–15.
- `aspect_ratio` (enum): `16:9`, `9:16`, or `1:1`.
- `generate_audio` (boolean): Whether to generate native audio for the video. Default in Fal is `true`.
- `negative_prompt` (string): Defaults to `"blur, distort, and low quality"`.
- `cfg_scale` (number): Guidance strength; default `0.5`.
- `voice_ids` (list<string>, optional): Optional voice IDs when voice control is used (not surfaced in UI yet).

## Keyframes mode support

Kling 3.0 I2V can be used in the Video Tools **Keyframes** workflow tab alongside Veo 3.1 First/Last Frame:

- When the user selects "Keyframes" mode, they can choose between Veo 3.1 First/Last Frame or Kling 3.0 I2V
- Kling 3.0 I2V treats the end frame (`end_image_url`) as **optional**, while Veo requires both frames
- The UI labels the last frame dropzone as "(optional)" when Kling 3.0 is selected in keyframes mode

## Output schema

- `video` (File): The generated video.
  - `url` (string): Public URL to the output file.
  - `content_type`, `file_name`, `file_size`: Additional file metadata.

Example response:
```json
{
  "video": {
    "file_size": 8431922,
    "file_name": "out.mp4",
    "content_type": "video/mp4",
    "url": "https://storage.googleapis.com/falserverless/example_outputs/kling-v3/pro-i2v/out.mp4"
  }
}
```

## Defaults used by ShortPulse

- `duration`: 10 seconds (aligned with the AI Studio video defaults).
- `aspect_ratio`: `16:9` (unless the user selects another allowed aspect).
- `generate_audio`: `true` (audio toggle in the UI controls this).
- `negative_prompt`: `"blur, distort, and low quality"`.
- `cfg_scale`: `0.5`.
- `voice_ids`: not set (voice control is not exposed in the UI yet).

## Pricing (USD → credits)

Credits are derived as `credits = ceil(usd / 0.01)`.

- Audio off: `$0.224` per second.
- Audio on: `$0.336` per second.
- Audio + voice control: `$0.392` per second (only when `voice_ids` are used).

Example: a 5s clip with audio on and voice control costs `$1.96` → `196` credits.

## Example request (proxy)

```json
{
  "prompt": "A craftsperson gently examines a handmade bowl in warm window light.",
  "start_image_url": "https://storage.googleapis.com/falserverless/example_inputs/kling-v3/pro-i2v/start_image.png",
  "duration": 10,
  "aspect_ratio": "16:9",
  "generate_audio": true,
  "negative_prompt": "blur, distort, and low quality",
  "cfg_scale": 0.5
}
```

## Operational notes

- During launch, Fal limits Kling 3.0 Pro concurrency to 3 requests per account; request higher limits via Fal support.
- For large images, prefer hosted URLs over base64 data URIs for better performance.
