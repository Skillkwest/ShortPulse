# Developer Analytics Stat Sheet

**Total lines of code: 514,046**

Generated: April 29, 2026

## Summary

- Source files counted: 2,165
- Physical source lines: 514,046
- Nonblank source lines: 471,699
- Line definition: physical lines in source, test, SQL, script, style, and config files; blank and comment lines are included in the total.
- Exclusions: prose docs, binary/design assets, dependency folders, generated/build outputs, coverage/test reports, temp folders, local secret env files, `.git/`, `.venv/`, `.vercel/`, `.husky/_/`, `.claude/`, and `mini-ecosystem/`.

## Lines By System

| System | Files | Lines | Nonblank Lines | Share |
| --- | ---: | ---: | ---: | ---: |
| Frontend Tests | 653 | 168,693 | 152,197 | 32.8% |
| Frontend Feature Modules | 711 | 166,712 | 157,140 | 32.4% |
| Frontend Styles | 76 | 51,865 | 45,410 | 10.1% |
| Frontend Shared Libraries | 208 | 47,371 | 43,689 | 9.2% |
| Supabase SQL | 225 | 23,622 | 21,614 | 4.6% |
| Frontend API Routes | 135 | 18,614 | 16,991 | 3.6% |
| Repo Scripts | 52 | 11,925 | 10,642 | 2.3% |
| Repo Config | 33 | 8,759 | 8,677 | 1.7% |
| Frontend Pages | 26 | 8,650 | 8,241 | 1.7% |
| Database Schema Reference | 1 | 2,385 | 2,101 | 0.5% |
| Frontend Shared UI & Prefabs | 16 | 2,128 | 1,998 | 0.4% |
| GitHub Automation | 10 | 1,598 | 1,449 | 0.3% |
| Frontend Scripts | 5 | 837 | 747 | 0.2% |
| Supabase Config | 1 | 388 | 340 | 0.1% |
| Frontend Config | 5 | 308 | 296 | 0.1% |
| Frontend Other Source | 5 | 149 | 132 | 0.0% |
| Frontend Types | 1 | 36 | 29 | 0.0% |
| Git Hooks | 2 | 6 | 6 | 0.0% |

## Lines By Language / File Type

| Language / Type | Files | Lines | Nonblank Lines | Share |
| --- | ---: | ---: | ---: | ---: |
| TypeScript | 1,428 | 300,718 | 276,876 | 58.5% |
| TSX | 320 | 109,946 | 102,018 | 21.4% |
| CSS | 76 | 51,865 | 45,410 | 10.1% |
| SQL | 226 | 26,007 | 23,715 | 5.1% |
| JavaScript | 55 | 14,154 | 12,674 | 2.8% |
| JSON | 30 | 8,321 | 8,320 | 1.6% |
| YAML | 14 | 1,596 | 1,449 | 0.3% |
| Shell | 10 | 978 | 835 | 0.2% |
| TOML | 1 | 388 | 340 | 0.1% |
| TypeScript Declarations | 2 | 42 | 34 | 0.0% |
| Config / Hook | 3 | 31 | 28 | 0.0% |

## Largest Source Files

| Rank | File | System | Lines | Nonblank Lines |
| ---: | --- | --- | ---: | ---: |
| 1 | `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx` | Frontend Tests | 7,977 | 7,076 |
| 2 | `frontend/styles/ai-studio-edit-expert.css` | Frontend Styles | 5,972 | 5,254 |
| 3 | `frontend/styles/ai-studio-voices-properties.css` | Frontend Styles | 3,159 | 2,802 |
| 4 | `frontend/features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx` | Frontend Tests | 3,118 | 2,728 |
| 5 | `frontend/styles/character-manager.css` | Frontend Styles | 2,858 | 2,480 |
| 6 | `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts` | Frontend Tests | 2,790 | 2,606 |
| 7 | `frontend/styles/ai-studio-layout.css` | Frontend Styles | 2,493 | 2,199 |
| 8 | `frontend/features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx` | Frontend Tests | 2,387 | 2,164 |
| 9 | `docs/supabase_full_schema.sql` | Database Schema Reference | 2,385 | 2,101 |
| 10 | `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentBridge.test.ts` | Frontend Tests | 2,317 | 2,154 |
| 11 | `frontend/tests/api/fal-status-proxy.test.ts` | Frontend Tests | 2,277 | 2,080 |
| 12 | `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx` | Frontend Tests | 2,264 | 2,049 |
| 13 | `frontend/styles/ai-studio-video-theme.css` | Frontend Styles | 2,230 | 1,971 |
| 14 | `frontend/features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx` | Frontend Tests | 2,205 | 1,930 |
| 15 | `frontend/features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts` | Frontend Tests | 2,197 | 1,914 |
| 16 | `frontend/styles/admin.module.css` | Frontend Styles | 2,058 | 1,766 |
| 17 | `frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx` | Frontend Feature Modules | 1,897 | 1,775 |
| 18 | `frontend/features/ai-studio/components/__tests__/VoicesPropertiesPanel.test.tsx` | Frontend Tests | 1,870 | 1,601 |
| 19 | `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx` | Frontend Feature Modules | 1,824 | 1,776 |
| 20 | `frontend/styles/workspace-media.css` | Frontend Styles | 1,818 | 1,563 |

## Notes

- Counts include both tracked source files and untracked source files currently present in the repo working tree.
- `mini-ecosystem/` is excluded because the repo instructions treat it as a separate entity unless explicitly requested.
- Markdown documentation is excluded from the code total; this sheet is focused on code-bearing files only.
