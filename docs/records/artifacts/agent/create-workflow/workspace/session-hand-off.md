# Session Hand-Off

Purpose: give the next Create Workflow run a concise operational hand-off.

## Where We Left Off

- The active implementation uses a split attachment contract:
  - `imageUrl` is preview-only.
  - `submissionImageUrl` is durable submission authority.
  - new local image drops upload at drop time and move through `deliveryStatus: "preparing" -> "ready" | "failed"`.
- Standard Generate, Pulse Generate, and chat send should be blocked while an image attachment is still `preparing` or has `failed`.
- The runtime capture helper now includes `getDiagnosis()` for first-pass classification, and the ingest tooling carries that diagnosis into reports.

## What Not To Repeat

- Do not start with another blind preview fallback patch if production is still failing.
- Do not treat local test passes as proof that the production symptom is gone.
- Do not reintroduce local `blob:` or `data:` URLs as model submission authority.
- Do not debug the chip visual alone without also checking delivery state and the final model-send payload.
- Do not widen the lane into unrelated media panel or deployment work unless the runtime capture points there.

## What To Do First Next Time

1. Confirm the deployed build contains the May 18 drop-time upload and readiness-gate code.
2. Enable `createWorkflowDebug`.
3. Capture one failing Standard repro and one Pulse repro only if Pulse is still reported broken.
4. Save the JSON in `workspace/captures/`.
5. Run the summarizer or ingest CLI.
6. Decide the next fix from `getDiagnosis()`, `deliveryStatus`, `submissionImageUrl`, rendered `img.src`, and send-payload evidence.

## Likely Remaining Failure Class

Most likely if the issue still exists:

- upload delivery never reaches `ready`,
- the chip chooses a stale preview source,
- the storage URL is not renderable in production,
- or send preparation still rejects a ready attachment.

The runtime helper exists to sort those classes without another speculative patch.
