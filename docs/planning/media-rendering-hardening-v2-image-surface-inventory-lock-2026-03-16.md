# Media Rendering Hardening v2 Image Surface Inventory Lock (2026-03-16)

Last updated: 2026-03-16  
Status: Active

## Purpose
Maintain authoritative image-surface inventory for all render callsites touched by this program.

## Classification Rules
1. `hot-path`: frequent user path with high render volume or critical interaction flow.
2. `long-tail`: less frequent surface; still covered for consistency.

## Inventory Fields
Each row must include:
1. `surface_id`
2. `path`
3. `render_type` (`next/image` or `img`)
4. `surface_class` (`hot-path` or `long-tail`)
5. `owner`
6. `parity_tests`
7. `notes`

## Seed Inventory (initial lock)
| surface_id | path | render_type | surface_class | owner | parity_tests | notes |
| --- | --- | --- | --- | --- | --- | --- |
| IMG-HOT-001 | `frontend/features/media-library/components/MediaAssetGallery.tsx` | `img` | hot-path | Engineering | media library grid tests | Route gallery hot path |
| IMG-HOT-002 | `frontend/features/media-library/components/MediaFileModal.tsx` | `img` | hot-path | Engineering | detail modal tests | Full-quality modal path |
| IMG-HOT-003 | `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaGrid.tsx` | `img` | hot-path | Engineering | modal media tests | AI Studio modal grid |
| IMG-HOT-004 | `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx` | `img` | hot-path | Engineering | panel preview tests | Panel preview modal |
| IMG-HOT-005 | `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx` | `img` | hot-path | Engineering | reference-grid parity tests | Signed URL optimizer seam |
| IMG-HOT-006 | `frontend/features/ai-studio/components/DetailModal.tsx` | `img` | hot-path | Engineering | detail modal tests | Reference detail path |
| IMG-HOT-007 | `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx` | `img` | hot-path | Engineering | canvas panel tests | Canvas side panel media |

## Governance
1. New surfaces must be added here before behavior changes.
2. Surface class changes require rationale in decision log.
3. No surface can be removed from this lock without explicit decommission note.
