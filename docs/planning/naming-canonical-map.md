# Naming Canonical Map

Status: Active  
Last updated: 2026-02-23

Purpose: single source of truth for canonical terms, compatibility policy, and sunset targets.

## Term Map

| Domain | Legacy term | Canonical term | Current policy | Sunset target |
| --- | --- | --- | --- | --- |
| User-facing AI Studio surface | Reference Canvas | Reference Grid | Canonicalize in active docs/UI now; keep internal aliases during migration | After phase 7 closeout |
| Component symbol | `ReferenceCanvas` | `ReferenceGrid` | Add canonical alias first; migrate callsites in slices | >= 2 release cycles |
| Reference-grid component file path | `reference-grid/components/ReferenceCanvasCard.tsx` | `reference-grid/components/ReferenceGridCard.tsx` | Canonical file path active; retain legacy-path shim file | >= 2 release cycles |
| Reference-grid component file path | `reference-grid/components/ReferenceCanvasSections.tsx` | `reference-grid/components/ReferenceGridSections.tsx` | Canonical file path active; retain legacy-path shim file | >= 2 release cycles |
| Reference-grid component file path | `reference-grid/components/ReferenceCanvasArchiveControls.tsx` | `reference-grid/components/ReferenceGridArchiveControls.tsx` | Canonical file path active; retain legacy-path shim file | >= 2 release cycles |
| Component props type | `ReferenceCanvasProps` | `ReferenceGridProps` | Keep both during bridge window | >= 2 release cycles |
| Hook symbol | `useAiStudioReferenceCanvasProps` | `useAiStudioReferenceGridProps` | Add canonical alias first; migrate callsites in slices | >= 2 release cycles |
| Hook symbol | `useReferenceGridCanvasDropController` | `useReferenceGridDropController` | Canonical symbol active; retain deprecated alias export | >= 2 release cycles |
| Reference-grid controller file path | `reference-grid/controllers/useReferenceGridCanvasDropController.ts` | `reference-grid/controllers/useReferenceGridDropController.ts` | Canonical file path active; retain legacy-path shim file | >= 2 release cycles |
| Test file path | `components/__tests__/ReferenceCanvas.curated.test.tsx` | `components/__tests__/ReferenceGrid.curated.test.tsx` | Canonical test file path active; migrated without compatibility shim | Immediate |
| Test file path | `components/__tests__/ReferenceCanvas.paste.test.tsx` | `components/__tests__/ReferenceGrid.paste.test.tsx` | Canonical test file path active; migrated without compatibility shim | Immediate |
| Test file path | `components/__tests__/ReferenceCanvas.selectorStore.test.tsx` | `components/__tests__/ReferenceGrid.selectorStore.test.tsx` | Canonical test file path active; migrated without compatibility shim | Immediate |
| Test file path | `components/__tests__/TextPropertiesPanel.test.tsx` | `components/__tests__/CreatePropertiesPanel.test.tsx` | Canonical test file path active; migrated without compatibility shim | Immediate |
| Test file path | `hooks/__tests__/useAiStudioReferenceCanvasProps.test.ts` | `hooks/__tests__/useAiStudioReferenceGridProps.test.ts` | Canonical test file path active; migrated without compatibility shim | Immediate |
| Public asset path | `/flux%20LOGO.png` | `/flux-logo.png` | Canonical path active in runtime references; legacy file retained | >= 2 release cycles |
| Public asset path | `/Google%20LOGO.png` | `/google-logo.png` | Canonical path active in runtime references; legacy file retained | >= 2 release cycles |
| Public asset path | `/Kling%20LOGO.png` | `/kling-logo.png` | Canonical path active in runtime references; legacy file retained | >= 2 release cycles |
| Public asset path | `/Seedream%20LOGO.png` | `/seedream-logo.png` | Canonical path active in runtime references; legacy file retained | >= 2 release cycles |
| Public asset path | `/Sora%202%20LOGO.png` | `/sora-2-logo.png` | Canonical path active in runtime references; legacy file retained | >= 2 release cycles |
| Public asset path | `/tiny%20logo.png` | `/tiny-logo.png` | Canonical path active in runtime references; legacy file retained | >= 2 release cycles |
| Public asset path | `/Gray.png` | `/background-gray.png` | Canonical path active in runtime references; legacy file retained | >= 2 release cycles |
| Public asset path | `/dashboard/performance%20analytics.png` | `/dashboard/performance-analytics.png` | Canonical path active in runtime references; legacy file retained | >= 2 release cycles |
| Public asset path | `/dashboard/media_library_purp.png` | `/dashboard/media-library-purple.png` | Canonical path active in runtime references; legacy file retained | >= 2 release cycles |
| Create panel symbol | `TextPropertiesPanel` | `CreatePropertiesPanel` | Add canonical alias first; migrate callsites in slices | >= 2 release cycles |
| Create panel props type | `TextPropertiesPanelProps` | `CreatePropertiesPanelProps` | Add canonical alias first; migrate callsites in slices | >= 2 release cycles |
| Grid drop type symbol | `ReferenceCanvasDropMode` | `ReferenceGridDropMode` | Migrate internal controller consumers; keep deprecated type alias | >= 2 release cycles |
| View-model prop key | `referenceCanvasProps` | `referenceGridProps` | Migrate runtime callsites; keep deprecated prop key bridge in `AiStudioPageContentProps` | >= 2 release cycles |
| File-drop handler symbol | `handleReferenceCanvasFiles` | `handleReferenceGridFiles` | Migrate runtime callsites; keep deprecated handler alias in workspace actions/page props | >= 2 release cycles |
| File input ref key | `referenceCanvasFileInputRef` | `referenceGridFileInputRef` | Migrate runtime callsites; keep deprecated prop key bridge in `AiStudioPageContentProps` | >= 2 release cycles |
| Active docs panel reference | `ReferencePropertiesPanel` | `EditPropertiesPanel` / `VideoPropertiesPanel` (context-dependent) | Fix immediately in active docs | Immediate |
| Character DB compat fields | `reference_pack_*` | `character_sheet_*` | Intentional dual-path compatibility per ADR 0011 | Separate program only |

## Non-Authoritative Scope Policy
- Files under `docs/archive/` and `docs/brainstorming/` are non-authoritative for naming audits.
- Archive content may preserve legacy terms for historical traceability.

## Update Rules
1. Any new naming variant discovered during a slice must be recorded here.
2. High-impact unresolved variants require a decision-log entry before proceeding.
3. Canonical map changes require tracker update and evidence linkage.
4. Active docs must pass `scripts/check_naming_canonical_drift.js` (via `npm -C frontend run docs:check`) before merge.
5. Runtime legacy alias usage must pass `scripts/check_naming_legacy_usage.js` (via `npm -C frontend run validate`) before merge.
