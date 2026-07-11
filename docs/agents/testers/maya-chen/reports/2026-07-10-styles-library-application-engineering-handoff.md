# Engineering Handoff: Styles Library Application

Date: 2026-07-10
Tester: Maya Chen
Scenario: Choose a consistent visual style for Tiny Apartment Reset Kit.
Production surface: `https://www.shortpulse.ai/ai-studio`
Session duration: about 25 minutes.
Credits spent: 0
Run status: completed; primary bug claim retracted after viewport correction

## Summary

On the production regular-user surface, Maya restored the five built-in styles and inspected `Digicam Photorealism`. In Create, clicking the composer `Styles` control set it to an expanded/active state while no picker was visible in the captured viewport. The user later established that this Chrome window was only about 75% size and did not show the right rail where Styles opens. The run therefore did not prove a broken Styles control.

A separate customer-copy defect exposes Admin and Agent Instructions terminology inside the built-in style detail view.

Decision impact: do not open engineering work for a broken style picker from this report. A maximized, full-width production regression is required first. The separately observed customer-copy concern remains actionable.

## Validation Boundary

- Observed through visible regular-user actions in a fresh but non-maximized Google Chrome window.
- Maya used only Dashboard, her saved project, Styles Library, and Create.
- Maya did not access Admin, APIs, code, database state, or hidden customer state.
- One normal close/reopen retry repeated the absence within the clipped viewport, which is not valid proof that the right-rail content failed to render.
- Visible account balance remained `1,542 / 1,200`; no generation or credit debit occurred.
- Browser evidence proves the customer symptom, not the implementation cause.

## RETRACTED: ST-01 Create Styles Control Expands Without A Picker

- Severity: `Unconfirmed; do not action`
- Retraction reason: Chrome was approximately 75% size and the intended right-rail target was outside the represented workspace.
- Route: production AI Studio, project `Tiny Apartment Reset Kit`, Create surface
- Customer impact: a customer can discover available styles but cannot confidently apply one before spending credits.
- Product impact: blocks style-based image generation and creates direct conversion and support risk.

### Reproduction

1. Open an existing project in production AI Studio as a regular user.
2. Open Styles Library.
3. If built-ins are absent, click `Restore built-ins` and confirm style tiles appear.
4. Return to Create.
5. Click the composer `Styles` control.
6. Observe that the control becomes active/expanded but no style picker or options appear.
7. Close and reopen the control once; the failure persists.

Expected: a visible, keyboard-accessible picker opens and includes restored built-ins such as `Digicam Photorealism`; choosing one yields an unambiguous selected-style state before generation.

Actual in this invalid viewport: the control reported an expanded state while the expected right rail was not visible.

Acceptance criteria:

- Clicking Styles visibly renders the canonical style picker in the current viewport.
- Restored built-ins are available in that picker without reload gymnastics.
- Keyboard and accessible-tree behavior agree with the visual open/closed state.
- Selecting a style visibly identifies the chosen style before generation.
- Closing and reopening preserves intentional selection behavior.

Next proof boundary: repeat the exact customer flow in a maximized, full-width Chrome window and confirm the complete right rail is visible before and after clicking Styles.

Source boundary: none established. Do not inspect or edit product code for ST-01 unless the corrected production regression reproduces objective breakage.

## ST-02 Internal Admin Copy Is Exposed To Customers

- Severity: `P2 customer trust/copy defect`
- Surface: built-in style detail modal
- Observed copy: `Admins can change built-in style previews from Agent Instructions.`
- Related copy says the style is managed globally by ShortPulse and can be deleted from the customer's library without changing it for anyone else.
- Customer impact: Maya believed she had entered an employee-only setting and became uncertain about whether her actions affected other accounts.

Acceptance criteria:

- Regular users receive customer-facing ownership and removal language only.
- Admin-only preview-management instructions are absent from customer surfaces.
- Removing/restoring a built-in retains the existing account-scoped semantics.

## Agent Fix Packet

- Issue tags: `ai-studio`, `styles`, `popover`, `broken-control`, `customer-copy`, `credit-confidence`
- Active owner/lane: customer-copy owner for ST-02; no implementation owner should act on retracted ST-01.
- Approved scope: correct regular-user copy after source audit. Style-picker implementation is outside evidence-backed scope until regression proof exists.
- Source of truth: production reproduction above plus the canonical Create style-selector implementation and existing style-library contracts.

Protected behavior:

- Styles Library restore/delete behavior and account-scoped library ownership.
- Global built-in style definitions and previews.
- Existing selected-style generation semantics.
- Project, Media, Reference Grid, Quick Slot, and Canvas persistence.
- Generate CTA, model pricing, credit quote, and billing behavior.
- Admin-only style management remains available only on authorized Admin surfaces.

Focused validation:

1. Maximize Chrome to full available width and height and verify the complete production desktop shell and right rail.
2. Repeat restore, Create, and Styles selection through visible regular-user actions.
3. Only if objective breakage reproduces, trace and test closed, open, select, change, close, and reopen states.
4. Verify built-ins restored in Styles Library appear in Create.
5. Verify a selected style reaches the existing generation request without changing pricing or credit debit behavior.
6. Verify customer style detail contains no Admin or Agent Instructions copy.
7. Run relevant AI Studio style-selector tests and a production Chrome regression after deploy.

Stop/escalation conditions:

- Stop before any ST-01 code change without a corrected production reproduction.
- Stop before changing global style ownership, built-in deletion semantics, generation payload semantics, pricing/credits, persistence, authorization, or Admin behavior.
- Stop if the correct fix requires a new style authority, compatibility path, fallback picker, or broad AI Studio state rewrite.
- Do not claim production resolution until a regular-user Chrome regression proves picker visibility and selection after deploy.

## Evidence

- [Styles expanded with no visible picker](assets/2026-07-10-styles-library-application/01-styles-expanded-no-picker.png)
- [Evidence manifest](assets/2026-07-10-styles-library-application/evidence-manifest.md)

## Admin Publish Status

Published successfully to Agent Tester Reports.

- Ingest proof: HTTP `200`, `ok: true`
- External run id: `2026-07-10-styles-library-application`
- Stored row id: `9a38923f-25fe-46db-aecf-5df256e307e6`
- Maya did not access Admin; owner/operator review is separate.
