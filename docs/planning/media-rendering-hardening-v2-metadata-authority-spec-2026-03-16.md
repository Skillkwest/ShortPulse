# Media Rendering Hardening v2 Metadata Authority Spec (2026-03-16)

Last updated: 2026-03-16  
Status: Active

## Purpose
Define one authoritative dimension/metadata policy from ingest to render.

## Authoritative Contract
1. Ingest path computes canonical metadata when possible.
2. Canonical metadata propagates unchanged through list/resolve/render surfaces.
3. Render surfaces consume canonical metadata only; no ad hoc overrides.

## MIME/Dimension Policy
1. Allowed MIME signatures and dimension parser support must be aligned.
2. If MIME is allowed but parser cannot determine dimensions, fallback metadata policy must be deterministic and explicit.
3. Fallback state must not break list/render behavior.

## Fallback Metadata Policy
1. Preserve source MIME and file-type classification.
2. Set dimensions to explicit null state with canonical marker.
3. Do not infer random/default dimensions.
4. Allow later enrichment paths to update metadata deterministically when available.

## Invariant Tests
1. Upload and copy-from-url metadata propagation invariants.
2. List/resolve/render consistency assertions for width/height fields.
3. Parser mismatch coverage for HEIC/HEIF/AVIF and other allowed signatures.
