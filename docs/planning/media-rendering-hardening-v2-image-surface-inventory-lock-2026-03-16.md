# Media Rendering Hardening v2 Image Surface Inventory Lock (2026-03-16)

Last updated: 2026-03-18
Status: active  

## Purpose
Maintain authoritative image-surface inventory for all render callsites touched by this program.

## Classification Rules
1. `hot-path`: frequent user path with high render volume or critical interaction flow.
2. `long-tail`: less frequent surface; still covered for consistency.

## Inventory Fields
Each row must include:
1. `surface_id`
2. `surface_key`
3. `path`
4. `render_type` (`next/image`, `img`, or `video-poster/img`)
5. `surface_class` (`hot-path` or `long-tail`)
6. `owner`
7. `source_classes`
8. `optimizer_rule`
9. `signing_rule`
10. `parity_tests`
11. `notes`

## Seed Inventory Lock
| surface_id | surface_key | path | render_type | surface_class | owner | source_classes | optimizer_rule | signing_rule | parity_tests | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IMG-HOT-001 | historical-predecessor-grid | historical predecessor image grid | `img` | historical hot-path | Engineering | signed storage, trusted direct | signed URLs historically bypassed adaptive transform path | historical predecessor preview profile | historical grid tests | Historical predecessor only |
| IMG-HOT-002 | media-library-modal | `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaGrid.tsx` | `img` | hot-path | Engineering | signed storage, trusted direct | modal helper resolves adaptive preview or unchanged signed URL | modal preview profile | modal media tests | AI Studio modal grid |
| IMG-HOT-003 | media-library-panel | `frontend/features/ai-studio/components/MediaLibraryPanel.tsx` | `img` | hot-path | Engineering | signed storage, trusted direct | panel-specific resolver currently borrows modal adaptive semantics | panel preview profile | panel tests + panel preview resolver tests | Policy drift seam |
| IMG-HOT-004 | reference-grid | `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx` | `img` | hot-path | Engineering | signed storage, trusted direct, local blob | signed/object URLs can be routed through `/_next/image` | preview profile `none` today | reference-grid parity tests | Signed URL optimizer seam |
| IMG-HOT-005 | quick-slot | `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx` | `img` | hot-path | Engineering | signed storage, local blob | shares reference-grid machinery with quick-slot surface variant | preview profile `none` today | curated reference tests | Separate policy row required |
| IMG-HOT-006 | detail-modal | `frontend/features/ai-studio/components/DetailModal.tsx` | `img` | hot-path | Engineering | signed storage, trusted direct | prefers full-quality path; adaptive quality disabled | preview profile `none` today | detail modal tests | Full-quality policy surface |
| IMG-HOT-007 | character-grid | `frontend/features/character-manager/components/CharacterManagerShell.tsx` | `next/image` | hot-path | Engineering | signed storage, trusted direct | adaptive helper exists but rendering often stays `unoptimized` | preview profile `none` today | character manager behavior tests | Partial adaptive integration |
| IMG-HOT-008 | quick-swap | `frontend/features/character-manager/components/CharacterQuickSwapDeckSection.tsx` | `next/image` | hot-path | Engineering | signed storage, trusted direct | grid preview helper + `unoptimized` render | preview profile `none` today | character quick-swap tests | Character hot path |
| IMG-HOT-009 | media-library-file-modal | `frontend/features/media-library/components/MediaFileModal.tsx` | `img` | hot-path | Engineering | signed storage, trusted direct, video signed direct | direct signed modal render | selected-file signed URL | media file modal tests | Media Library preview/detail surface |
| IMG-HOT-010 | media-library-panel-preview-modal | `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx` | `img` | hot-path | Engineering | signed storage, trusted direct, video signed direct | direct panel preview modal render | panel preview resolver output | panel preview modal tests | Panel-specific preview/detail surface |
| IMG-LONG-001 | dashboard-tool-card | `frontend/pages/dashboard.tsx` | `next/image` | long-tail | Engineering | static/trusted direct | currently `unoptimized` | none | dashboard smoke | Long-tail consistency target |
| IMG-LONG-002 | performance-card | `frontend/features/performance/components/CompactVideoCard.tsx` | `img` | long-tail | Engineering | external trusted direct | raw thumbnail render | none | performance smoke | Long-tail raw `<img>` |
| IMG-LONG-003 | performance-detail-modal | `frontend/features/performance/components/VideoDetailModal.tsx` | `img` | long-tail | Engineering | external trusted direct | raw detail modal render | none | performance modal smoke | Performance detail surface |
| IMG-LONG-004 | saved-creators-avatar | `frontend/features/saved-creators/components/SavedCreatorTable.tsx` | `img` | long-tail | Engineering | external trusted direct | raw avatar render | none | saved creators smoke | Long-tail raw avatar |
| IMG-LONG-005 | agent-chat-thumbnail | `frontend/prefabs/agent/panels/AgentChatPanel.tsx` | `img` | long-tail | Engineering | generated thumbnail direct | raw thumbnail render | none | agent panel smoke | Long-tail generated preview |
| IMG-LONG-006 | landing-testimonial-image | `frontend/pages/landing.tsx` | `next/image` | long-tail | Engineering | trusted external static | next/image remote render | none | landing smoke | Marketing long-tail surface |
| IMG-LONG-007 | prompt-step-attachment-preview | `frontend/features/ai-studio/components/promptStep/PromptStepChatSurface.tsx` | `img` | long-tail | Engineering | staged/signed direct preview | raw attachment preview render | none | prompt step smoke | Prompt/composer image surface |
| IMG-LONG-008 | canvas-item-image | `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx` | `img` | long-tail | Engineering | editor-managed/local image source | raw canvas image render | none | canvas smoke | Canvas/editor image surface |

## Known Queued Surfaces Pending P0 Classification Detail
Repo scan still shows additional image surfaces that do not yet need dedicated contract rows before Foundation `P0` closure, but they do require explicit disposition. These remain explicitly queued work, not ignored work.

| queued_key | path | render_type | disposition | notes |
| --- | --- | --- | --- | --- |
| dashboard-brand-logo | `frontend/pages/dashboard.tsx` | `next/image` | `ui-chrome-or-static` | Brand asset; not part of adaptive/signing delivery contract work |
| dashboard-hero-graphic | `frontend/pages/dashboard.tsx` | `next/image` | `ui-chrome-or-static` | Marketing-style hero art; keep discoverable but out of hot-path contract slices |
| character-profile-photo | `frontend/features/character-manager/components/CharacterManagerShell.tsx` | `next/image` | `queued-to-parent-surface: character-grid` | User-visible character photo surface; promote to a dedicated `P3` row if policy or parity work expands beyond current character-grid scope |
| character-reference-preview-overlay | `frontend/features/character-manager/components/CharacterManagerShell.tsx` | `next/image` | `queued-to-parent-surface: quick-swap` | Quick-swap detail preview overlay; currently tracked under quick-swap parity unless P3 needs a dedicated detail row |
| create-character-trigger | `frontend/features/ai-studio/components/create/StandardCreatePanelView.tsx` | `next/image` | `ui-chrome-or-static` | Character picker trigger avatar plus model logo; user-visible selection chrome, not a media-library delivery surface |
| create-expert-character-trigger | `frontend/features/ai-studio/components/create/ExpertCreatePanelView.tsx` | `next/image` | `ui-chrome-or-static` | Character picker trigger avatar plus model logo; selection chrome only |
| edit-reference-model-picker | `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx` | `next/image` | `ui-chrome-or-static` | Model logo picker chrome; not a signed-preview contract surface |
| edit-character-picker-modal | `frontend/features/ai-studio/components/edit/ExpertEditCharacterPickerModal.tsx` | `next/image` | `ui-chrome-or-static` | Character avatar selection chrome; signed avatar behavior should follow Character Manager policy, not create a new media surface contract |
| create-properties-character-picker | `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx` | `next/image` | `ui-chrome-or-static` | Character avatar selection chrome; not a standalone delivery policy surface |
| ai-studio-toolbar-logo | `frontend/features/ai-studio/components/AiStudioToolbar.tsx` | `next/image` | `ui-chrome-or-static` | Static product logo |
| model-modal-logo-grid | `frontend/features/ai-studio/components/ModelModal.tsx` | `next/image` | `ui-chrome-or-static` | Static model logos |
| reference-model-step-logo | `frontend/features/ai-studio/components/ReferenceModelStep.tsx` | `next/image` | `ui-chrome-or-static` | Static model logo picker chrome |

## Governance
1. New surfaces must be added here before behavior changes.
2. Surface class changes require rationale in the decision log.
3. No surface can be removed from this lock without explicit decommission note.
4. Surface keys here must match the surface policy matrix and tracker references.
5. Queued annex entries require an explicit disposition and a promotion-or-defer note; they may not remain anonymous lists.
