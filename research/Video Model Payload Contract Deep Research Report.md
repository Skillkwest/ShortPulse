# Video Model Payload Contract Deep Research Report

## Canonical schema as the single source of truth

A robust way to stop “field drift” across UI builders, API routes, provider adapters, billing, and docs is to declare one canonical contract per model (or per model-endpoint) and derive everything else from it. The most interoperable “contract artifact” for this job is **JSON Schema**, because it is explicitly designed to describe and validate JSON document structure and can also serve documentation purposes. citeturn18search24turn18search0

The key enforcement mechanism (and the one that directly prevents top-level drift) is to **close the object** at the contract boundary by forbidding unknown properties. In JSON Schema this is typically done with `additionalProperties: false` on objects (and, if you compose schemas with `allOf`/`anyOf`, using `unevaluatedProperties` to ensure nested/combined schemas don’t accidentally re-open property sets). citeturn1search0turn18search5turn18search4

For TypeScript-heavy codebases, there are two common “single source” patterns:

- **Schema-first (JSON Schema-first)**: JSON Schema is canonical; you generate (a) runtime validators (e.g., Ajv), (b) TypeScript types for clients, and (c) docs snippets (OpenAPI-ish outputs or Markdown fragments) from the same schema artifact. JSON Schema is a standard media type intended for validation and documentation-like uses, which makes it a good canonical layer. citeturn18search24turn1search0turn18search27  
- **TypeScript-first (Zod-first)**: Zod schemas live in code and infer TS types automatically, and you generate a JSON Schema/OpenAPI representation for docs and non-TS consumers. Zod explicitly positions itself as TypeScript-first schema validation with type inference, which reduces duplication inside TS stacks. citeturn2search14turn2search6

Given your specific goals (“client payload types, route allowlists/validation, provider normalizers, docs snippets, drift prevention”), the schema-first approach tends to be simplest to govern because “the schema” is already a portable artifact. JSON Schema also provides the exact features you need for unknown-field policy (`additionalProperties`, `unevaluatedProperties`, per-property `type`/`enum`, etc.). citeturn1search0turn18search5turn18search4

On the validator implementation side, Ajv is widely used for JSON Schema validation in Node environments, and its “strict mode” is relevant because it helps catch schema mistakes and ambiguous constructs earlier (even though strictness itself is about how the validator treats schemas, not the runtime payload). citeturn1search4turn1search5


## Provider ground-truth input contracts

This section captures **what providers say they accept**, because provider docs are the only defensible baseline for “provider docs allow” columns in your ground-truth sheet.

### entity["company","fal.ai","generative media platform"] contracts you can treat as authoritative

**Kling v3 Pro (image-to-video)** on fal exposes these inputs (selected list): `prompt` or `multi_prompt` (mutually exclusive), `start_image_url` (required), `duration` (seconds), `generate_audio`, optional `end_image_url`, optional `voice_ids`, optional `elements`, optional `shot_type`, optional `negative_prompt`, and optional `cfg_scale`. citeturn10view0

Two details matter for contract hardening:

- The model description explicitly says **either `prompt` or `multi_prompt` must be provided, but not both**, which is a schema-level constraint that will otherwise drift if each layer re-implements it differently. citeturn10view0  
- Voice control has a usage constraint: fal’s Kling v3 Pro schema indicates you can reference voices and implies a maximum count (the docs describe “maximum 2 voices per task” semantics). citeturn10view0

**Kling O3 (image-to-video, standard)** includes `prompt` and `image_url` (required), optional `end_image_url`, `duration` as an enumerated set of seconds (3–15 with a default shown as `"5"`), optional `generate_audio`, optional `multi_prompt`, and optional `shot_type`. The schema also lists `negative_prompt` for other related request types (text-to-video, etc.). citeturn3view1

**Veo 3.1 Fast (image-to-video)** on fal exposes: required `prompt`, required `image_url`, plus `aspect_ratio` (default `"auto"`), `duration` (enum values like `"4s"`, `"6s"`, `"8s"`), `resolution` (e.g., `"720p"`, `"1080p"`, `"4k"`), `generate_audio`, `seed`, `auto_fix`, and `safety_tolerance` (API-only). citeturn7view0

**Veo 3.1 Fast (first/last frame to video)** is similar but requires `first_frame_url` and `last_frame_url` and supports the same “control” fields (`duration`, `resolution`, `generate_audio`, `seed`, `auto_fix`, `safety_tolerance`, etc.). citeturn6view2

**Seedance 1.0 Lite / Pro (image-to-video)** on fal exposes: required `prompt`, required `image_url`, optional `end_image_url`, plus `aspect_ratio`, `resolution`, `duration`, `camera_fixed`, `seed`, `enable_safety_checker`, and `num_frames` (which “overrides duration” when provided). Notably, examples show `"duration": "5"` even though the description is “duration in seconds.” citeturn14view1turn14view2

**Seedance 1.0 Lite (text-to-video)** similarly accepts `prompt`, `aspect_ratio`, `resolution`, `duration`, `camera_fixed`, `seed`, `enable_safety_checker`, and `num_frames`. citeturn14view0

fal’s async pattern uses a **webhook URL**: the docs explicitly say to pass `webhook_url` when submitting to the queue and describe how fal POSTs results back when complete. citeturn15view0

fal also documents **data retention controls** that matter for your “submit payload persistence minimization” and privacy posture. They state request payload JSON is stored (default 30 days) unless you opt out with `X-Fal-Store-IO: 0`; generated media is served as public URLs and can be configured with `X-Fal-Object-Lifecycle-Preference` (expiration seconds). citeturn19view1turn19view0

### entity["company","Kie.ai","ai video api provider"] Veo contract surface (distinct naming system)

Kie’s Veo 3.1 generation endpoint documents **camelCase** fields that differ from fal’s snake_case style: `imageUrls` (array), `generationType` (enum like `TEXT_2_VIDEO`, `FIRST_AND_LAST_FRAMES_2_VIDEO`, `REFERENCE_2_VIDEO`), `model` (e.g., `veo3_fast` vs `veo3`), `seeds` (integer) with a range constraint (10000–99999), and `callBackUrl` for completion callbacks. citeturn5view3turn5view4

Those naming differences are the direct reason you need a deliberate alias/normalization policy: otherwise, the system will drift into “some routes accept camelCase, some accept snake_case” and you will keep rediscovering missing-field failures.


## Canonical payload proposals and alias policy per model

This section answers your “ultra-narrow” asks by doing two things:

- choosing **one canonical internal contract per model/endpoint**, and  
- marking any non-canonical spellings as **accepted_at_edge only** (never stored, never billed, never passed to providers).

### Canonical naming principle

Because provider ecosystems here are mixed (fal is snake_case-heavy; Kie is camelCase-heavy), the most stable convention is:

- **Internal canonical**: snake_case, strongly typed, and normalized for semantics (e.g., duration as seconds integer).  
- **Edge flexibility**: accept legacy/camelCase aliases only at the boundary; transform immediately into canonical; reject collisions (same meaning provided twice with different values).  

This matches the “accept aliases at edge, normalize internally” approach you already called out, and it’s safer than trying to make every downstream layer accept every alias indefinitely (which multiplies drift surfaces).

### Canonical schema: Kie Veo 3.1 Fast image-to-video

Provider evidence: Kie documents `generationType`, `imageUrls`, `model`, `seeds`, and `callBackUrl`, with an explicit seed range. citeturn5view3turn5view4

Canonical internal JSON Schema (draft sketch):

```json
{
  "$id": "contracts/kie/veo31_fast_i2v.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["prompt", "model", "image_urls"],
  "properties": {
    "prompt": { "type": "string", "minLength": 1 },
    "model": { "type": "string", "enum": ["veo3_fast", "veo3"] },
    "generation_type": {
      "type": "string",
      "enum": ["TEXT_2_VIDEO", "FIRST_AND_LAST_FRAMES_2_VIDEO", "REFERENCE_2_VIDEO"]
    },
    "image_urls": {
      "type": "array",
      "items": { "type": "string", "format": "uri" },
      "minItems": 1,
      "maxItems": 3
    },
    "aspect_ratio": { "type": "string", "enum": ["16:9", "9:16", "auto"] },
    "seed": { "type": "integer", "minimum": 10000, "maximum": 99999 },
    "callback_url": { "type": "string", "format": "uri" }
  }
}
```

Rationale for `seed` normalization: Kie’s parameter is documented as `seeds` with a bounded range 10000–99999, so internal canonical should enforce the same bound and treat it as a single integer “seed” unless you explicitly want multi-seed batching. citeturn5view3

**accepted_at_edge only aliases (not persisted):**
- `generationType` → `generation_type` citeturn5view3  
- `imageUrls` → `image_urls` citeturn5view3  
- `callBackUrl` → `callback_url` citeturn5view3turn5view4  
- `seeds` → `seed` citeturn5view3  
- allow snake variant `generation_type` for clients that already send it (edge-only); canonical remains `generation_type`.

**collision rule (must be enforced):** if a request provides both `generationType` and `generation_type` (or both `seeds` and `seed`) and values differ, reject with 400/422. This prevents silent “last write wins” behavior, which otherwise becomes a hidden drift vector.

### Canonical schema: fal Veo 3.1 Fast image-to-video

Provider evidence: fal’s Veo 3.1 Fast image-to-video input includes `duration` as strings like `"8s"` and exposes billing-sensitive fields `resolution` and `generate_audio`. citeturn7view0

Canonical schema should normalize duration to seconds integer for billing correctness and cross-model uniformity:

```json
{
  "$id": "contracts/fal/veo31_fast_i2v.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["prompt", "image_url", "duration_seconds", "resolution", "generate_audio"],
  "properties": {
    "prompt": { "type": "string", "minLength": 1 },
    "image_url": { "type": "string", "format": "uri" },
    "aspect_ratio": { "type": "string", "enum": ["auto", "16:9", "9:16"] },
    "duration_seconds": { "type": "integer", "enum": [4, 6, 8] },
    "resolution": { "type": "string", "enum": ["720p", "1080p", "4k"] },
    "generate_audio": { "type": "boolean" },
    "seed": { "type": "integer" },
    "auto_fix": { "type": "boolean" },
    "safety_tolerance": { "type": "string", "enum": ["1", "2", "3", "4", "5", "6"] }
  }
}
```

This schema is derived from fal’s published inputs (`duration` enum values `"4s"`, `"6s"`, `"8s"`; `auto_fix`; `safety_tolerance`; etc.), but makes the “duration” semantic explicit for billing and internal consistency. citeturn7view0

**accepted_at_edge only aliases / coercions:**
- `duration` as `"8s"` / `"6s"` / `"4s"` → parse into `duration_seconds` citeturn7view0  
- `imageUrl` → `image_url` (edge-only convenience)  
- `generateAudio` → `generate_audio` (edge-only convenience)

### Canonical schema: fal Veo 3.1 Fast first/last frame to video

Provider evidence: requires `first_frame_url` and `last_frame_url` and uses the same control surface. citeturn6view2

Canonical changes: replace `image_url` with `first_frame_url`/`last_frame_url`, keep `duration_seconds` normalization.

### Canonical schema: fal Kling v3 Pro image-to-video

Provider evidence: schema includes advanced fields you specifically called out: `end_image_url`, `negative_prompt`, `voice_ids`, `multi_prompt`, `shot_type`, `elements`. citeturn10view0

Canonical schema should treat the “prompt vs multi_prompt” rule as a schema invariant:

```json
{
  "$id": "contracts/fal/kling_v3_pro_i2v.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["start_image_url", "duration_seconds"],
  "properties": {
    "prompt": { "type": "string" },
    "multi_prompt": { "type": "array" },
    "start_image_url": { "type": "string", "format": "uri" },
    "end_image_url": { "type": "string", "format": "uri" },
    "duration_seconds": { "type": "integer", "minimum": 3, "maximum": 15 },
    "generate_audio": { "type": "boolean" },
    "voice_ids": { "type": "array", "items": { "type": "string" }, "maxItems": 2 },
    "elements": { "type": "array" },
    "shot_type": { "type": "string" },
    "negative_prompt": { "type": "string" },
    "cfg_scale": { "type": "number" }
  },
  "oneOf": [
    { "required": ["prompt"], "not": { "required": ["multi_prompt"] } },
    { "required": ["multi_prompt"], "not": { "required": ["prompt"] } }
  ]
}
```

The `maxItems: 2` on `voice_ids` matches fal’s published constraint language (“maximum 2 voices per task”). citeturn10view0

**advanced fields decision matrix (supported vs unsupported):**
- Supported: `end_image_url`, `negative_prompt`, `voice_ids`, `multi_prompt`, `shot_type`, `elements` — because they are explicitly part of the fal input schema for Kling v3 Pro I2V and therefore represent legitimate provider capabilities. citeturn10view0  
- Unsupported-only-by-policy: you would only mark these as unsupported if you deliberately want a smaller product surface (and then your docs/tests must enforce that shrinkage).

### Canonical schema: fal Seedance (t2v + i2v) with duration normalization

Provider evidence: Seedance endpoints on fal accept `duration` but commonly show `"duration": "5"` in examples; i2v accepts `end_image_url`; and `num_frames` overrides duration. citeturn14view0turn14view1turn14view2

The clearest internal policy is:

- Canonical: `duration_seconds` as integer  
- Edge: accept `duration` as either `"5"` or `5` and coerce  
- If `num_frames` is provided, it overrides duration the way provider docs describe; represent that explicitly (so it’s testable). citeturn14view0turn14view1

This also directly answers your “Seedance duration typing policy” requirement:

**Decision: internal duration type = integer seconds.**  
Justification: Veo uses string tokens like `"8s"`; Seedance examples use `"5"`; Kling examples show `"12"`; a numeric canonical avoids letting billing read “stringly typed” duration values inconsistently across providers. citeturn7view0turn14view1turn10view0


## Unknown-field policy by environment and validation precedence

### Evidence on why unknown fields matter

Schema closure (`additionalProperties: false`) is the mechanical way to reject unknown fields at validation time. JSON Schema documentation explicitly describes how object schemas and additional/unevaluated properties work. citeturn18search5turn1search0turn18search4

From an API evolution standpoint, there is real disagreement in industry guidance about whether to ignore or reject unknown fields. One widely-cited set of practices (Zalando’s REST guidelines) recommends **not ignoring unknown input fields** and returning a client error, noting that silently ignoring unknown fields hides client mistakes and can create future compatibility conflicts (and they explicitly call out PUT semantics and drift risks). citeturn21view0

### Unknown-field handling matrix

A pragmatic approach that matches your “dev vs prod” requirement is to differentiate behavior by environment but keep production strict at the boundary for submit endpoints:

| Environment | Submit routes (POST create generation) | Rationale |
|---|---|---|
| dev | Reject unknown top-level fields (detailed error listing unknown keys). | Fast drift discovery; prevents “validator-normalizer mismatch” from hiding. citeturn21view0turn18search5 |
| prod | Reject unknown top-level fields; emit telemetry on unknown keys and alias usage; do not silently drop. | Prevents unbilled/unsupported params sneaking through; avoids silent typos; aligns with conservative input guidance. citeturn21view0turn20view0 |

The telemetry requirement is not optional if you want to harden contracts without breaking clients unexpectedly: you need visibility into what unknown/legacy fields are arriving in the wild. OWASP explicitly recommends logging input validation failures and designing logs to be useful for investigation, while also emphasizing what data to exclude or sanitize. citeturn20view0

### Validator-layer precedence rule

Your system currently has (at least) two places that can “decide” what is acceptable: a route validator and a provider normalizer. The only durable precedence model is:

**Canonical contract is source-of-truth.**  
- Route validators enforce canonical schema at the edge.  
- Provider normalizers take *only canonical payloads* and emit provider-specific bodies.

If the provider normalizer accepts fields that the route validator rejects, you have a reconciliation problem that will keep reappearing as drift. Conversely, if the route validator allows fields the normalizer drops or transforms unexpectedly, billing and docs become unreliable. This is why the contract has to be the shared spine, not either implementation layer. (This is also aligned with contract-testing framing: contracts should be explicit and enforced, not implicit.) citeturn0search6turn0search8


## Contract parity automation, billing parity, and route-level test architecture

### Route-level contract testing spec

A route-by-route contract test should verify four stages end-to-end:

1. builder produces payload  
2. route validates payload against canonical schema  
3. provider normalizer outputs provider body  
4. expected upstream payload matches what provider docs require

This is exactly the type of scenario contract testing targets: schemas alone do not guarantee the provider integration keeps working if each layer drifts independently. citeturn0search6turn0search8

A practical way to implement this:

- Keep “golden upstream bodies” as fixtures per model route.
- For each test, assert strict deep equality (or canonical JSON equivalence) on the final upstream payload.
- Add **negative tests** that confirm rejection of:
  - forbidden top-level fields  
  - alias collisions (e.g., both `generationType` and `generation_type`)  
  - unrecognized advanced fields (if you intentionally don’t support them)

Because your systems also depend on webhook delivery and asynchronous workflows, include at least one test that asserts that the normalized payload includes the correct callback field for that provider (fal uses `webhook_url` when queue-submitting; Kie uses `callBackUrl`). citeturn15view0turn5view3

### Billing-field parity audit requirements

Your explicit requirement (“billed dimensions must come from normalized canonical payload, not raw submit body”) is especially important here because provider pricing is explicitly sensitive to:

- duration (per-second charging)  
- audio generation (`generate_audio`)  
- resolution tiers (e.g., 4k vs 1080p)  
- voice control (for Kling voice IDs)

fal’s Veo pricing pages describe pay-per-second rates that differ by resolution and audio, and they provide concrete examples (e.g., different per-second cost without vs with audio, and separate 4k pricing). citeturn22search3turn22search15turn22search7

fal’s Kling pricing pages and model pages similarly show per-second pricing and higher cost bands when audio and voice control are enabled. citeturn22search18turn22search11turn22search2

Given this, the billing system must read only canonical normalized values (e.g., `duration_seconds`, `resolution`, `generate_audio`, and “voice control active” derived from canonical `voice_ids`) so that it cannot diverge from what actually survives validation/normalization.

### Governance script hardening and docs/runtime parity

To make “parity checks” real gates, they need to fail on conditions beyond “route exists”:

- a referenced test file is missing (script/suite integrity gate)  
- field-level schema drift (builder vs schema vs normalizer)  
- docs-runtime drift (docs snippets must be generated from schemas)

The trustworthy way to satisfy “docs contract snippets generated from runtime schema” is to treat docs as a render step over contracts, not an authored artifact. This aligns with formal interface definitions (OpenAPI/JSON Schema) being the canonical representation of request/response shapes. citeturn2search15turn18search24


## Reference URL exposure, persistence minimization, and telemetry redaction

### Reference URL privacy model: signed URLs with `/characters/<id>/...`

A presigned URL is explicitly meant to be **shared** to extend access until expiration time, and the credential context of the signer governs what it permits. citeturn16view0turn22search4turn22search0  
Cloudflare’s S3-compatible presigned URL guidance is blunt about the operational security model: **treat presigned URLs as bearer tokens** (anyone with the URL can perform the operation until it expires). citeturn22search12

If you embed internal semantics like `/characters/<id>/...` inside the object key or path component of URLs you send to external providers, you are intentionally disclosing:
- internal object taxonomy, and  
- stable internal identifiers (“character ID”) that can appear in third-party logs, support tickets, or incident artifacts.

Even if your buckets are private, the URL itself is an access grant and is typically logged in multiple places in distributed systems. OWASP’s logging guidance highlights that logs often should not record sensitive identifiers or internal file paths verbatim; where such data appears, it should be removed, masked, sanitized, hashed, or pseudonymized depending on risk. citeturn20view0

### If character path exposure is not allowed: indirection patterns

If you decide “no internal path semantics leave our boundary,” you need an indirection layer. The most common patterns are:

- **Opaque media handle**: client submits `media_handle` (opaque random token). Your server resolves it to an internal blob reference and either:  
  - proxies the bytes to the provider, or  
  - mints a provider-facing URL that has no internal semantics (e.g., random UUID key, short TTL).  
- **Relay URL (proxy fetch)**: provider receives a URL on your domain that streams the media and enforces access policy; the provider never sees your storage key layout.  
- **Upload to provider-managed storage**: some platforms support uploading assets into their managed CDN/storage. If you do this, you still must evaluate retention and “public URL” behavior.

fal’s docs are relevant here because they explicitly state that generated media is stored on fal’s CDN and served as public URLs, and they provide retention controls and opt-outs for request payload storage. citeturn19view1turn19view0  
This means that “uploading to fal” can simplify provider access but does not automatically solve confidentiality concerns—public URLs and retention settings become part of your privacy model.

### Submit payload persistence minimization

Based on common security logging and retention guidance:

- Store only what you need to reproduce jobs, debug systemic failures, and bill correctly.
- Avoid persisting raw prompts and raw user media URLs in logs/telemetry unless you have a concrete, justified operational need and a defined retention window.
- Treat callback URLs and access tokens as sensitive.

OWASP explicitly lists classes of data that “should usually not be recorded directly,” including access tokens and sensitive personal data, and it also flags that file paths and internal network identifiers may require special handling or sanitization. citeturn20view0

For provider-facing payload minimization, fal offers a concrete mechanism for reducing stored data: `X-Fal-Store-IO: 0` prevents storing the JSON request/response payload on their platform (while warning that CDN files may still remain accessible). citeturn19view0turn19view1

For log retention, authoritative federal guidance positions log management as a lifecycle (generate, transmit, store, analyze, dispose) and stresses having policies and procedures for retention and disposal. citeturn22search5turn20view0


## Dev-runtime HMR stability in Next 16.1.x

Your “isrManifest/pages hot reloader” concern is consistent with publicly reported Next 16-era dev-mode issues in the Pages Router + Turbopack/HMR pipeline.

Evidence points to two closely related symptom clusters:

- A Next.js issue report describes a Turbopack HMR invalid message (`appIsrManifest`) and a TypeError caused by `window.next.router` being undefined during HMR event processing in the Pages Router. citeturn9view0  
- A separate Next 16 ecosystem repo documents a Pages Router HMR warning involving `{"type":"isrManifest","data":{"/":true}}` and a TypeError reading `components` inside `hot-reloader-pages.ts`. citeturn9view1  

In the same version band, there are also reports of global CSS hot reload breakage on Next 16.1.1+, with a workaround of forcing webpack (`next dev --webpack`) restoring expected hot reload behavior in at least some projects. citeturn8search1

Next’s own documentation frames Fast Refresh as a development-time mechanism that updates modules without a full reload, but the above issues show that in practice some HMR event handling paths can still crash or degrade dev experience depending on router mode and bundler. citeturn0search7

Given this evidence, the “safest mitigation path” for local reliability (without changing your app architecture) is typically to **separate dev bundler strategy from production** (e.g., run dev with webpack if Turbopack is exhibiting the isrManifest/hot reloader crash). The cited issues show the failure is in dev tooling/HMR event handling rather than in application submit logic. citeturn9view0turn8search1turn9view1