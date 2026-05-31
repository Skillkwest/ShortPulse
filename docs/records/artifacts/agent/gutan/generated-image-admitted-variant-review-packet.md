# Generated Image Admitted Variant Review Packet

Purpose: provide Nuclo and Dave the exact context, questions, and copy/paste prompts needed before Gutan implements Phase 5 generated-image reuse admission.

Status: pending Nuclo/Dave review. Do not implement Phase 5 until this packet is answered or explicitly superseded by the user.

Owner requesting review: Gutan, ShortPulse Media Ingestion Normalization Steward.

Review owners:

- Nuclo: Supabase schema, storage topology, migration, hosted-operation, and storage-accounting review.
- Dave the Security Guy: RLS, private storage, service-role, signed URL, user-isolation, and fail-closed security review.

## Why This Review Is Needed

Gutan has implemented the first image-admission lanes that do not require new schema authority:

- canonical server image admission helper;
- durable Media Library / Reference Grid upload admission;
- `/api/media/admit-image-asset` for Character and Elements image assets;
- Character Manager direct-upload migration;
- Elements Manager profile-image migration;
- trusted remote still-image copy admission.

The next planned phase is generated-image reuse admission. This is different because generated images may need to keep their original/full-quality object for save, detail, and export while provider/product-use paths receive a <=25 MB admitted derivative.

The preferred durable representation is a first-class `media_asset_variants` row with:

- `variant_kind = 'admitted_reference_25mb'`;
- user-scoped object storage under a variants namespace;
- metadata linking the derivative to the image-admission policy;
- no Supabase image transformations.

This crosses into Nuclo and Dave authority because it may require schema changes, storage-accounting decisions, RLS/security validation, and service-role write boundary review.

## Gutan Product Requirement

Generated image reuse must preserve full-quality original authority.

Behavior required:

- If a generated image original is <=25 MB, product-use/provider-reference paths may use it directly.
- If a generated image original is >25 MB, ShortPulse creates or fetches an admitted <=25 MB derivative lazily on first product-use need.
- The generated original remains the authority for detail, save, download, and export.
- Provider submit/product-use paths select the admitted derivative.
- Repeated reuse should fetch the existing admitted derivative instead of recompressing.
- Successful derivative admission should be quiet and should not add UI copy, layout, controls, gestures, or right-rail behavior changes.
- Over-25 MB animated images remain intentionally rejected in v1.
- Supabase may store admitted derivatives as ordinary objects, but Supabase must never create them.

Forbidden:

- Supabase signed URL `transform` options;
- `/storage/v1/render/image/` URLs;
- Supabase image transformations as fallbacks, previews, compatibility lanes, experiments, or temporary mitigations;
- replacing or weakening original/full-quality generated-output authority;
- broad Reference Grid display optimization changes.

## Proposed Variant Shape For Review

Recommended variant kind:

```text
admitted_reference_25mb
```

Recommended storage path:

```text
<user_id>/variants/images/<media_file_id>/admitted_reference_25mb.<ext>
```

Recommended row:

```text
media_asset_variants
- media_file_id: original generated media_files.id
- user_id: original media owner
- variant_kind: admitted_reference_25mb
- storage_path: user-scoped derivative object
- mime_type: admitted derivative MIME
- width: admitted derivative width
- height: admitted derivative height
- byte_size: admitted derivative bytes
- status: ready | failed as existing variant contract allows
- metadata.image_admission: canonical admission metadata
```

Recommended image-admission metadata:

```text
image_admission.version
image_admission.status
image_admission.policy = shortpulse_image_admission_25mb
image_admission.max_bytes
image_admission.target_bytes
image_admission.original_bytes
image_admission.admitted_bytes
image_admission.original_mime_type
image_admission.admitted_mime_type
image_admission.original_width
image_admission.original_height
image_admission.admitted_width
image_admission.admitted_height
image_admission.strategy
image_admission.original_preserved = true
image_admission.original_storage_path
image_admission.admitted_storage_path
image_admission.supabase_transform_used = false
```

## Nuclo Review Questions

Nuclo should answer:

- Is `media_asset_variants.variant_kind = 'admitted_reference_25mb'` the correct durable schema shape for generated-image admitted derivatives?
- What migration is required to expand any `variant_kind` check constraints?
- Should admitted derivatives count toward storage usage/accounting, and if yes, through which existing accounting path?
- Is the recommended storage path compatible with existing media derivative namespaces and cleanup assumptions?
- Which docs must be updated if this variant kind is approved? Likely candidates: `docs/data-dictionary.md`, `docs/supabase_full_schema.sql`, route/API docs if new route behavior is exposed.
- Is any hosted Supabase validation required before implementation, or can Gutan prepare code plus migration for later Nuclo execution?
- If first-class variant rows are not approved now, is temporary metadata scaffolding acceptable? If yes, what is the exact removal condition?

Nuclo approval should explicitly state one of:

- Approved as first-class variant row.
- Approved only with required migration/doc changes listed.
- Deferred; use temporary metadata scaffold with removal condition.
- Blocked; do not implement Phase 5 yet.

## Dave Review Questions

Dave should answer:

- Does the proposed derivative path preserve per-user storage isolation?
- Is service-role-only derivative creation acceptable for this path if the route/helper first verifies the caller owns the original media row?
- What ownership checks must run before reading the original, writing the variant object, upserting the variant row, or signing the derivative?
- Are existing RLS/storage policies sufficient for `media_asset_variants` and private `media_library` paths, or does Phase 5 need additional SQL/security work?
- Should this derivative resolver be route-level authenticated, server-internal only, or both?
- What failure mode is required if derivative creation, variant upsert, signing, or ownership verification fails?
- Are there any SSRF, signed URL, stale URL, cross-user, cache, or cleanup risks unique to generated-image admitted derivatives?
- What tests or guard checks are required before Dave considers the boundary safe?

Dave approval should explicitly state one of:

- Approved with existing controls.
- Approved with required hardening/tests listed.
- Blocked pending more evidence.
- Blocked because the proposed shape weakens a protected boundary.

## Gutan Stop Condition

Gutan must stop before Phase 5 implementation when any of the following are true:

- Nuclo has not approved the schema/storage shape or an explicit temporary scaffold.
- Dave has not approved the security/user-isolation boundary or required hardening plan.
- The implementation would require Supabase image transformations.
- The implementation would replace or weaken full-quality generated original authority.
- The implementation would change Reference Grid display/detail/download behavior.
- The implementation would require new UI copy, layout, controls, gestures, or workflow behavior not explicitly approved by the user.
- The implementation would require hosted Supabase mutation, production config mutation, or credential access not explicitly approved in the current thread.

Gutan may continue only when:

- Nuclo's required storage/schema path is explicit;
- Dave's required security boundary is explicit;
- implementation can stay inside Gutan's product-use admission lane;
- validation gates are known.

## Copy/Paste Prompt For Nuclo

```text
Run Nuclo for a scoped review of Gutan's generated-image admitted derivative proposal.

Context:
- Gutan owns product image admission for ShortPulse generation/product-use images.
- Current product-use image cap is 25 MB.
- ShortPulse must never use Supabase image transformations: no signed URL transform options, no /storage/v1/render/image/ URLs, no transform fallbacks.
- Generated image originals must remain full-quality authority for detail, save, download, and export.
- Provider/product-use reuse should receive a <=25 MB admitted derivative when a generated original exceeds 25 MB.
- Gutan proposes adding media_asset_variants.variant_kind = admitted_reference_25mb, with storage path <user_id>/variants/images/<media_file_id>/admitted_reference_25mb.<ext>.

Please review only Nuclo-owned concerns:
- Supabase schema/migration shape.
- media_asset_variants constraint impact.
- storage namespace compatibility.
- storage usage/accounting implications.
- docs/schema snapshot updates required.
- hosted validation or migration-apply requirements.
- whether temporary metadata scaffolding is acceptable if first-class variant schema is deferred.

Source packet:
docs/records/artifacts/agent/gutan/generated-image-admitted-variant-review-packet.md

Expected output:
1. One of: approved as first-class variant row, approved with required changes, deferred with temporary scaffold/removal condition, or blocked.
2. Exact migration/doc/storage-accounting requirements.
3. Any stop conditions Gutan must honor before implementation.
4. Validation evidence Nuclo requires before the feature can be considered storage/schema-safe.

Do not mutate hosted Supabase, Vercel, GitHub, secrets, or production data unless I explicitly approve that exact action in this thread.
```

## Copy/Paste Prompt For Dave

```text
Run Dave for a scoped security review of Gutan's generated-image admitted derivative proposal.

Context:
- Gutan owns product image admission for ShortPulse generation/product-use images.
- Current product-use image cap is 25 MB.
- ShortPulse must never use Supabase image transformations: no signed URL transform options, no /storage/v1/render/image/ URLs, no transform fallbacks.
- Generated image originals must remain full-quality authority for detail, save, download, and export.
- Provider/product-use reuse should receive a <=25 MB admitted derivative when a generated original exceeds 25 MB.
- Gutan proposes storing the derivative as an ordinary private media object and a media_asset_variants row with variant_kind = admitted_reference_25mb.
- Recommended path: <user_id>/variants/images/<media_file_id>/admitted_reference_25mb.<ext>.

Please review only Dave-owned concerns:
- user isolation and ownership verification;
- private storage and signed URL boundaries;
- service-role read/write/upsert boundaries;
- RLS/storage policy assumptions;
- fail-closed behavior if ownership, derivative creation, variant upsert, or signing fails;
- SSRF/stale URL/cross-user/cache/cleanup risks;
- tests or guards required before implementation.

Source packet:
docs/records/artifacts/agent/gutan/generated-image-admitted-variant-review-packet.md

Expected output:
1. One of: approved with existing controls, approved with required hardening/tests, blocked pending evidence, or blocked because the shape weakens a protected boundary.
2. Exact ownership checks and failure behavior Gutan must implement.
3. Required tests or guard checks.
4. Any stop conditions Gutan must honor before implementation.

Do not request, display, store, or rely on raw secrets or customer-private data. Do not mutate hosted Supabase, Vercel, GitHub secrets, or production data unless I explicitly approve that exact action in this thread.
```

## Expected Gutan Next Step After Reviews

After Nuclo and Dave respond, Gutan should:

1. Update this packet or create a short review outcome note.
2. Update `image-admission-implementation-plan.md` with approved schema/security requirements.
3. Only then inspect the generated-output-to-provider-reference seam for implementation.
4. Stop again if the implementation requires a behavior, UI, storage, or security change not covered by the approvals.
