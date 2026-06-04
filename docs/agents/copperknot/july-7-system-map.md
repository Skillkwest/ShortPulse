# July 7 Launch System Map

Purpose: map ShortPulse by the human jobs that must work for the July 7, 2026 launch promise, then connect those jobs to repo systems and source areas.

## Mapping Rule

Use user jobs as the primary launch systems. Existing catalog rows remain useful implementation rows, but Copperknot may merge, split, or relabel them when the launch promise is clearer that way.

## Launch Systems

| Launch system | Human job | Current catalog rows absorbed | Primary source areas |
| --- | --- | --- | --- |
| `Public entry and account trust` | Arrive, understand the product, sign in, manage profile, and pass required compliance gates. | `Auth / identity`, `Pricing / entitlements`, portions of `Security boundaries` | `frontend/pages/auth*.tsx`, `frontend/pages/profile.tsx`, `frontend/lib/supabaseClient.ts`, `frontend/lib/protectedRoutes.ts`, `frontend/pages/api/account/*`, `docs/routes.md` |
| `AI Studio shell and navigation` | Enter the creative workspace and understand where to work without route, mode, or panel confusion. | `Create workflow`, `Reference Grid`, workflow rows | `frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/**`, `docs/product/shortpulse_ai_studio.md` |
| `Create and Pulse workflow` | Generate useful image outputs from Standard or Pulse while preserving prompt, reference, mode, and agent boundaries. | `Create workflow`, `Provider integrations`, `Generation submission / polling` | `frontend/features/ai-studio/components/create/**`, `frontend/features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts`, `frontend/pages/api/ai/studio-agent-*`, `frontend/pages/api/openai/image-generate.ts` |
| `Expert Edit workflow` | Edit an existing asset with understandable references, layers, prompts, output delivery, and save handoff. | `Edit workflow`, `Reference Grid`, `Media ingest / save` | `frontend/features/ai-studio/components/edit/**`, `frontend/pages/api/openai/image-edit.ts`, Edit SOPs/ADRs |
| `Video workflow` | Generate and handle video assets without unclear model constraints or broken output handling. | `Video workflow`, `Provider integrations`, `Generation submission / polling` | `frontend/features/ai-studio/**video**`, `frontend/pages/api/fal/kie-*`, `frontend/lib/server/api/videoSubmitContracts.ts` |
| `Sound workflow` | Generate voice, music, sound effects, and voice changer outputs with staged media and ownership clarity. | `Sound workflow`, `Provider integrations`, `Media ingest / save` | `frontend/pages/api/elevenlabs/**`, `frontend/pages/api/media/stage-*`, sound workflow components |
| `Creative libraries` | Create, edit, select, and reuse characters, elements, styles, presets, and Pulses. | `Characters workflow`, `Elements workflow`, related Create/Edit control-plane rows | `frontend/features/ai-studio/components/**character**`, `**elements**`, `**styles**`, `docs/sops/sop_character_manager_operations.md` |
| `Media library and organization` | Save, browse, search, folder, delete, and reopen media/prompts without losing global ownership clarity. | `Media Library workflow`, `Media ingest / save`, `Core data persistence` | `frontend/features/ai-studio/components/EmbeddedMediaLibraryPanel.tsx`, `frontend/pages/api/media/*`, media SOPs/ADRs |
| `Right-rail asset reuse` | Use Reference Grid, Quick Slot Inventory, and Canvas as shared workspace-global asset surfaces. | `Reference Grid`, parts of `Media delivery / signing / preview resolution` | `frontend/features/ai-studio/components/ReferenceGrid.tsx`, `frontend/features/ai-studio/reference-grid/**`, canvas components, ADR 0083 |
| `Projects and workspace restore` | Save a project, reopen it, restore durable assets, and avoid hidden session replay surprises. | `Project / workspace persistence`, `Core data persistence` | `frontend/pages/api/projects/**`, `frontend/lib/server/project*`, project ADRs/SOP |
| `Generation runtime and providers` | Submit jobs, poll or receive results, normalize provider contracts, and display outputs. | `Generation submission / polling`, `Provider integrations` | `frontend/pages/api/fal/**`, `frontend/pages/api/openai/**`, `frontend/lib/server/providerIntegration/**`, generation ADRs |
| `Recovery, settlement, and output integrity` | Resolve accepted jobs, settle credits, publish outputs, and recover from interrupted polling. | `Generation recovery / settlement`, `Billing / credits` | `frontend/lib/server/generationControlPlane/**`, `/api/internal/generation-recovery/run`, billing ledger services |
| `Credits, pricing, billing, and entitlements` | See accurate credits/prices, pay or receive entitlement, and trust debits/refunds. | `Billing / credits`, `Pricing / entitlements` | `frontend/pages/api/billing/**`, `frontend/pages/api/pricing/**`, `frontend/lib/server/api/modelPricing*`, billing SOPs/ADRs |
| `Storage, delivery, and variants` | Upload, sign, preview, derive, and download media securely and quickly. | `Storage / file delivery`, `Media delivery / signing / preview resolution`, `Media derivatives / variants` | `frontend/pages/api/media/sign-batch.ts`, `frontend/lib/server/media*`, `sql/configure_media_derivative_scheduler_supabase.sql` |
| `Security and ownership boundaries` | Keep accounts, media, projects, credits, admin tools, and provider-owned resources isolated. | `Security boundaries`, `Auth / identity`, storage and billing rows | `frontend/lib/server/api/auth.ts`, `frontend/proxy.ts`, `docs/security-checklist.md`, `sql/check_runtime_sql_security_audit.sql` |
| `Admin and launch operations` | Understand incidents, user health, billing support, reports, pricing state, and deployment health as one solo operator. | `Admin operations`, `Observability / incident triage`, operator map rows | `frontend/pages/admin/**`, `frontend/pages/api/admin/**`, `docs/operator-map.md`, `docs/troubleshooting.md` |
| `Quality of experience` | The app feels coherent, responsive, and finished enough for paid creative work. | Cross-cutting launch quality layer | route CSS, workflow components, media performance docs, UX evidence |

## Boundary Notes

- `Reference Grid`, `Quick Slot Inventory`, and `Canvas` stay workspace-global right-rail surfaces across AI Studio workflows.
- Project identity and workspace persistence are separate from legacy `sid` session identity.
- Media folders are user-global across projects.
- Provider execution and recovery are separate launch systems because success submission is not the same as reliable settlement and output integrity.
- Quality of experience is a launch system because confusing UX can block the launch promise even when code paths technically run.
