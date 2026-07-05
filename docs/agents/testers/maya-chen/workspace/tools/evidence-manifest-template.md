# Maya Evidence Manifest Template

Create a copy of this manifest inside each run's asset folder when the run keeps meaningful screenshots or files.

Do not keep screenshots by default. Keep them only when they are needed evidence for a product issue, credit-spend proof, output proof, save/find-it-again proof, or another finding that a later agent must inspect.

Run:
Date:
Scenario:
Asset folder:

| Artifact | Moment Captured      | Maya Meaning       | Used In                                      |
| -------- | -------------------- | ------------------ | -------------------------------------------- |
| `<path>` | `<what was visible>` | `<why Maya cared>` | `<Maya report / engineering handoff / both>` |

## Required Evidence For Generation Runs

- Before generation prompt/cost state.
- After generate click or visible progress state.
- Final output or failure state.
- Credit balance before and after when visible.
- Saved-work location such as Media, Reference Grid, Projects, or generated-output history.
- Downloaded file path when download is tested.

## Evidence Quality Rules

- Prefer a small set of meaningful screenshots over many repetitive polling screenshots.
- Do not keep routine screenshots of normal navigation, successful signup, or ordinary page state.
- Never include credentials, secrets, cookies, tokens, or private auth state.
- Redact or discard screenshots that show account emails, billing details, names, credentials, tokens, cookies, or other private account-identifying information.
- If a screenshot contains sensitive text, redact it or do not use it.
- Explain what each artifact proves from Maya's customer point of view.
