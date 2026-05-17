# Operator Brief Template

Purpose: give the user one ADHD-friendly post-run summary that makes the next actions obvious without rereading the full audit packet.

## When To Use This

Use this after every meaningful Copperknot run that changes one or more of:

- queue order
- handoff readiness
- launch-state status
- ship target window
- rerating decisions

## Required Shape

Create both:

- a rich-format HTML brief as the canonical user-facing operator brief
- a Markdown source brief as the backing traceability artifact

The HTML file is the real deliverable the user should open first.

At the top of the Markdown brief, add one short line that says it is source-only and points to the sibling HTML file.

# What Changed

- one short paragraph or 3-5 bullets max

# What You Can Paste Now

- ordered list from highest priority to lowest priority
- one line per lane
- include:
  - system name
  - lane id
  - status:
    - `already running`
    - `ready to paste now`
    - `ready but hold`
    - `reviewed complete`
  - exact handoff path

Only show lanes that still require user attention.

Do not show:

- closed lanes
- reviewed-complete lanes
- at-floor lanes that do not need a new paste action
- closeout intake history

# What To Do Next

- tell the user the exact next action
- keep it imperative and short

# Do Not Do Yet

- list lanes that should stay held, blocked, or closed
- say why in one short line each

# Notes

- only include if there is one high-signal caution or context note

## Writing Rules

- optimize for scan speed
- use large markdown headers
- prefer flat bullets
- avoid long prose
- make the next paste action unmistakable
- treat the operator brief as an action surface, not an archive surface
- for HTML companions, use large section headers, boxed lane cards, strong status labels, and simple color cues
- in HTML briefs, every referenced repo doc path should be a clickable link
- prefer relative links in HTML briefs so the docs open in the same in-app browser tab
- when the linked target is a Markdown repo doc, point the HTML brief at a browser-friendly `.html` companion instead of the raw `.md` file
