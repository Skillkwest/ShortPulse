---
name: skill-ui-ux-critic
description: Audit ShortPulse frontend UI/UX changes for modern design quality, accessibility, and trend-fit recommendations. Use when reviewing or implementing TSX/CSS changes, refining AI Studio/workspace surfaces, preparing UI-focused PRs, or requesting trend-informed design suggestions with concrete file-level actions.
---

# UI/UX Critic

Purpose: produce actionable, repo-specific UI/UX recommendations without trend chasing or large rewrites.

## Sources of truth
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/styles-structure.md`
- `docs/design/short-flow-color-system-design-rationale.md`
- `skills/skill-ui-ux-critic/references/ui-ux-checklist.md`
- `frontend/styles/*.css` files for touched surfaces
- Changed component/page files under `frontend/features/` and `frontend/pages/`

## Workflow
1. **Define scope**
   - Read changed files first (`git diff --name-only` or user-provided file list).
   - Limit the audit to touched surfaces and directly related style modules.
2. **Run baseline quality checks**
   - Verify hierarchy: one clear primary action and clear secondary actions.
   - Verify spacing rhythm, typography hierarchy, and visual grouping.
   - Verify color usage and state meaning against established palette guidance.
   - Verify component states: loading, empty, error, success, and disabled.
   - Verify responsive behavior at mobile and desktop breakpoints.
   - Verify keyboard/focus affordances and practical tap targets.
3. **Run UX flow checks**
   - Walk the first-time path and repeat-user path for touched flows.
   - Flag ambiguous labels, hidden actions, and unnecessary friction.
   - Flag areas where user effort is high but system feedback is weak.
4. **Run trend-fit pass**
   - Propose at most two modern patterns that fit current product goals.
   - Reject patterns that add motion/noise without usability gain.
   - Tie each proposal to specific files and expected outcomes.
5. **Score and prioritize**
   - Score each recommendation: `Impact (1-5)`, `Effort (1-5)`, `Confidence (1-5)`.
   - Label each item as `quick-win`, `next-sprint`, or `explore`.
6. **Deliver implementation-ready output**
   - Give exact file targets and minimal-diff patch intent.
   - Separate must-fix issues from optional enhancements.

## Trend-fit guardrails
- Prefer changes that improve clarity, speed, accessibility, or user trust.
- Keep visual language consistent with existing ShortPulse tokens and palette.
- Avoid new dependencies for cosmetic-only changes.
- Avoid global redesign recommendations unless explicitly requested.
- If external trend validation is requested, cite current sources and map them to repository constraints.

## Output format (recommended)
```
UI/UX audit report
- Scope: <files or surfaces>
- Overall risk: low | medium | high

Must-fix
- [severity] <issue> in <file> -> <change>

High-value improvements
- <suggestion> in <file> | Impact:X Effort:Y Confidence:Z | <why>

Trend-fit opportunities
- <pattern> -> <where to apply> -> <expected UX benefit>

Implementation order
1) <quick win>
2) <next>
3) <optional>
```

## If user asks to implement
- Implement must-fix and highest-value quick wins first.
- Keep diffs narrow and scoped to existing modules.
- Run relevant checks (`npm -C frontend run lint` when feasible) and report any validation gaps.
