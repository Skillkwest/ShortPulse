# Fal.ai Kling 3.0 Pro Text-to-Video API Reference

Use this guide to submit and poll Kling 3.0 Pro text-to-video jobs via the Fal queue (`fal-ai/kling-video/v3/pro/text-to-video`). ShortPulse proxies these requests through Next API routes to keep `FAL_KEY` server-side.

## Authentication

- **API key**: Set `FAL_KEY` in your runtime environment and pass it via `Authorization: Key $FAL_KEY`.
- **Security**: Never expose `FAL_KEY` in client-side code; use the ShortPulse proxy endpoints below.

## Queue workflow

1. **Submit** the job via the ShortPulse proxy:
   - `POST /api/fal/kling-v3-text-submit`
2. **Poll** for status:
   - `POST /api/fal/kling-status` with `{ "requestId": "..." }`
3. **Fetch result**: the status proxy automatically fetches the result once the queue reports completion.

## Fal queue endpoints (for reference)

- Submit: `POST https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video`
- Status: `GET https://queue.fal.run/fal-ai/kling-video/requests/$REQUEST_ID/status`
- Result: `GET https://queue.fal.run/fal-ai/kling-video/requests/$REQUEST_ID`

## Request schema (subset used by ShortPulse)

- `prompt` (string, required): The text prompt for the video generation.
- `duration` (number): Duration in seconds. Allowed enum values: 3–15.
- `multi_prompt` (list, optional): Multi-shot prompts with per-shot durations (not surfaced in UI yet).
- `shot_type` (enum, optional): `customize` or `intelligent` (defaults to `customize`).
- `aspect_ratio` (enum): `16:9`, `9:16`, or `1:1`.
- `generate_audio` (boolean): Whether to generate native audio for the video. Default in Fal is `true`.
- `negative_prompt` (string): Defaults to `"blur, distort, and low quality"`.
- `cfg_scale` (number): Guidance strength; default `0.5`.
- `voice_ids` (list<string>, optional): Optional voice IDs when voice control is used (not surfaced in UI yet).

## Output schema

- `video` (File): The generated video.
  - `url` (string): Public URL to the output file.
  - `content_type`, `file_name`, `file_size`: Additional file metadata.

Example response:
```json
{
  "video": {
    "file_size": 8062911,
    "file_name": "output.mp4",
    "content_type": "video/mp4",
    "url": "https://storage.googleapis.com/falserverless/example_outputs/kling-v3/pro-t2v/out.mp4"
  }
}
```

## Defaults used by ShortPulse

- `duration`: 10 seconds (aligned with the AI Studio video defaults).
- `aspect_ratio`: `16:9` (unless the user selects another allowed aspect).
- `generate_audio`: `true` (audio toggle in the UI controls this).
- `negative_prompt`: `"blur, distort, and low quality"`.
- `cfg_scale`: `0.5`.
- `multi_prompt` + `voice_ids`: not set (multi-shot + voice control are not exposed in the UI yet).

## Pricing (USD → credits)

Credits are derived as `credits = ceil(usd / 0.01)`.

- Audio off: `$0.224` per second.
- Audio on: `$0.336` per second.
- Audio + voice control: `$0.392` per second (only when `voice_ids` are used).

Example: a 5s clip with audio on and voice control costs `$1.96` → `196` credits.

## Example request (proxy)

```json
{
  "prompt": "Close-up of glowing fireflies dancing in a dark forest at twilight.",
  "duration": 5,
  "aspect_ratio": "16:9",
  "generate_audio": true,
  "negative_prompt": "blur, distort, and low quality",
  "cfg_scale": 0.5
}
```

## Operational notes

- During launch, Fal limits Kling 3.0 Pro concurrency to 3 requests per account; request higher limits via Fal support.
- For long-running tasks, rely on the queue status polling endpoint rather than blocking.
