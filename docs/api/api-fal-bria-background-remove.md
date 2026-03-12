# Fal.ai Bria Background Remove API Reference

Reference for integrating Bria RMBG (`fal-ai/bria/background/remove`) through ShortPulse Fal proxies.
ShortPulse catalog model id: `fal-ai/bria/background/remove`.

## Authentication
- Set `FAL_KEY` in the server runtime only.
- Proxies attach `Authorization: Key $FAL_KEY` before forwarding.

## Submit (Background Remove)
### Proxy endpoint
`POST /api/fal/bria-background-remove-submit`

### Fal queue
`POST https://queue.fal.run/fal-ai/bria/background/remove`

Example payload:
```json
{
  "image_url": "https://fal.media/files/panda/K5Rndvzmn1j-OI1VZXDVd.jpeg"
}
```

### Input fields
- `image_url` (string, required): source image URL (public URL or data URI).
- `sync_mode` (boolean, optional): when true, returns data URI output and skips request-history persistence.

## Status and result
- Poll `POST /api/fal/bria-background-remove-status` with `{ "requestId": "..." }`.
- Proxy checks Bria queue status endpoints and then fetches final result when complete.
- Catalog fallback bases include both:
  - `https://queue.fal.run/fal-ai/bria/requests`
  - `https://queue.fal.run/fal-ai/bria/background/remove/requests`

## Output schema
Typical result shape:
```json
{
  "image": {
    "url": "https://v3.fal.media/files/...png",
    "content_type": "image/png",
    "file_name": "output.png",
    "file_size": 1076276,
    "width": 1024,
    "height": 1024
  }
}
```

## ShortPulse defaults and wiring notes
- Expert Edit `Remove Background` action sends only `image_url` (no prompt field).
- Model remains hidden from the model picker; trigger path is action-driven only.
- Polling provider token: `fal-bria-background-remove`.

## Pricing (ShortPulse)
- Expert Edit `Remove Background` is billed at **1 credit** per run.
- Submit uses the standard Fal billing reservation/debit pipeline on `/api/fal/bria-background-remove-submit`.
- UI regenerate path relies on the model pricing strategy (no forced credit override).

## Security notes
- Never expose `FAL_KEY` in browser code.
- Keep requests server-side through `/api/fal/*` routes.
