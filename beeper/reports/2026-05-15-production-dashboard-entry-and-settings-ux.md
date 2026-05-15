# Beeper Workflow / UX Audit

Purpose: fuller Beeper-owned analysis of the signed-in production dashboard entry funnel and the adjacent account/settings workflow.

## Run Metadata

- Date: 2026-05-15
- Environment: production
- Base URL: https://www.shortpulse.ai
- Runtime project ref: ftgrqgjrchpimronuhop
- Audit user: `aiagentayla@gmail.com`
- Workflow tested: dashboard launch surface -> project entry CTAs -> projects zero state -> account/settings path

## User Story

- Starting intent: a signed-in user lands on the dashboard and wants to start working or inspect account state.
- Expected path: choose a clear entry action, understand whether a project is required, and reach the next working surface without interpretation debt.
- Actual path: the dashboard summary is clear, but the main work-entry cards are semantically muddy and keep the user on the dashboard longer than the labels imply.

## What Felt Good

- The dashboard top summary does a good job of grounding the user in storage, credits, and plan.
- The avatar/account menu is straightforward and discoverable.
- The settings subsections are well-labeled and explain state clearly:
  - Subscription explains plan, renewal, credits, and storage.
  - Credits explains available balance and renewal behavior.
  - Media storage explains current usage and add-on state.
  - Transactions sets expectations for an internally managed account.

## Bottlenecks

### 1. Dashboard AI Studio entry says one thing and does another

- Surface: dashboard hero `New Project` card with helper text `Open the AI Studio`
- What a real user expects: click and enter AI Studio, or at least land on an AI Studio-specific setup surface.
- What actually happens: the user stays on `/dashboard` and gets an inline `Name project` modal.
- Why this slows or confuses the workflow:
  - the action label describes destination, not the actual first step
  - the user has to mentally reframe the product model from “open studio” to “create project before studio”
  - it makes the dashboard feel like a trap door instead of a launch surface
- Severity: `P2`
- Evidence:
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/dashboard-entry-flow-summary.json`
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/real-user-05-dashboard-ai-studio-cta-modal.png`
- Likely contributing code surfaces:
  - `frontend/features/dashboard/components/AuthenticatedDashboardView.tsx:74`
  - `frontend/pages/dashboard.tsx:577`
- Fix options:
  - change the copy to match reality: `Create Project` / `Start in AI Studio`
  - or navigate into AI Studio immediately and handle project naming there
  - or open a dedicated project setup surface that clearly explains “projects open in AI Studio”
- Recommended fix direction:
  - If project-first is intentional, rename the dashboard card to `Create Project` and use helper copy like `Projects open in AI Studio`.
  - Reserve `Open the AI Studio` for actual studio navigation.

### 2. Two dashboard project-entry labels collapse to the same destination

- Surface: `Open Projects` and `Open the project library`
- What a real user expects: two distinct actions or at least one main action and one clearly different secondary path.
- What actually happens: both labels open the same in-page projects overlay and keep the user on `/dashboard`.
- Why this slows or confuses the workflow:
  - creates false choice
  - teaches the user that labels are not trustworthy
  - adds cognitive overhead without adding capability
- Severity: `P3`
- Evidence:
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/dashboard-entry-flow-summary.json`
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/real-user-06-open-projects.png`
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/real-user-07-open-project-library.png`
- Likely contributing code surfaces:
  - `frontend/features/dashboard/components/AuthenticatedDashboardView.tsx:91`
  - `frontend/features/ai-studio/components/ProjectsModal.tsx:364`
- Fix options:
  - collapse to one label
  - or keep both only if they truly separate “resume current work” from “browse all projects”
- Recommended fix direction:
  - Use one primary label, likely `Open Projects`, and remove the duplicate helper wording unless it points somewhere materially different.

### 3. Generic project creation is one click away

- Surface: project-name modal and projects zero state
- What a real user expects: either a meaningful starter name suggestion with context, or a clear prompt to name the project intentionally.
- What actually happens: the modal is prefilled with `Untitled project`, so `Create` is immediately enabled.
- Why this slows or confuses the workflow:
  - it optimizes speed at the expense of future project hygiene
  - it encourages generic saved project names during the first run
  - the user can create clutter before understanding the project model
- Severity: `P3`
- Evidence:
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/workflow-bottlenecks-summary.json`
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/real-user-10-project-modal-blank.png`
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/real-user-11-project-modal-typed.png`
- Likely contributing code surfaces:
  - `frontend/features/projects/components/ProjectNameModal.tsx:1`
  - `frontend/features/projects/hooks/useProjectCreationDialog.ts:21`
  - `frontend/features/projects/logic/projectCreateClient.ts:7`
- Fix options:
  - keep the prefill but auto-select it and explicitly encourage renaming
  - keep the prefill and add helper text like `You can rename this later`
  - require an explicit non-default name before enabling `Create`
- Recommended fix direction:
  - Keep the prefill for speed, but make the intent clearer:
    - helper copy: `Start with a name now, or rename later`
    - stronger label: `Create project`
    - consider warning only when the user tries to keep the generic name repeatedly

### 4. Production dashboard trust is undercut by testing-style announcement copy

- Surface: dashboard hero announcement slot
- What a real user expects: polished product or operational messaging.
- What actually happens: the production slot says `Yooo! I wired this up to make announcements. We can publish announcements to all users very easy.`
- Why this slows or confuses the workflow:
  - weakens trust immediately after sign-in
  - makes the app feel unfinished even when the underlying product works
- Severity: `P3`
- Evidence:
  - dashboard screenshots and both Beeper production dashboard runs
- Likely contributing code surfaces:
  - likely control-plane content rather than route implementation
- Fix options:
  - remove it
  - replace with polished production copy
  - hide the slot when there is no real announcement
- Recommended fix direction:
  - Do not show testing-style messaging on production dashboard surfaces.

## Secondary UI / UX Notes

- The projects zero state itself is reasonably clear: it explains what a project is for and offers a next step.
- The account/settings area is a stronger information architecture reference point than the dashboard hero entry cards.
- The dashboard currently feels more like an operations summary than a true launch surface, because its main work-entry CTAs require interpretation.

## Product Behavior Questions

- Is the product intentionally project-first for all AI Studio entry?
- If yes, why is the dashboard still using `Open the AI Studio` language instead of `Create Project` language?
- Should projects live as an overlay on the dashboard, or should they have a clearer dedicated destination?

## Fix Strategy

- Short-term:
  - rename the dashboard hero cards so they describe the real first click
  - remove duplicate project-entry wording
  - replace the production testing-style announcement copy
- Medium-term:
  - decide whether project creation belongs on the dashboard or inside AI Studio
  - make the launch surface consistently reflect that model
  - improve generic-name handling for first-time project creation
- Risks:
  - changing only copy without clarifying the underlying entry model may reduce one confusion point but leave the broader workflow awkward

## Evidence Index

- JSON:
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/real-user-exploratory-summary.json`
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/dashboard-entry-flow-summary.json`
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/profile-entry-summary.json`
  - `beeper/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/workflow-bottlenecks-summary.json`
- Screenshots:
  - `real-user-01-dashboard.png`
  - `real-user-05-dashboard-ai-studio-cta-modal.png`
  - `real-user-06-open-projects.png`
  - `real-user-07-open-project-library.png`
  - `real-user-10-project-modal-blank.png`
  - `real-user-11-project-modal-typed.png`
  - `real-user-12-projects-modal-zero-state.png`
  - `real-user-13-projects-modal-new-project.png`
  - `real-user-08-profile-menu.png`
  - `real-user-09-settings.png`
  - `real-user-14-settings-tabs.png`
- Related retained report:
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-real-user-exploratory.md`
