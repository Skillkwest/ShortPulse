# Maya Run Folder Structure

Use this structure for each completed run.

## Reports

```text
docs/agents/testers/maya-chen/reports/
  YYYY-MM-DD-short-slug-maya-report.md
  YYYY-MM-DD-short-slug-engineering-handoff.md
  assets/
    YYYY-MM-DD-short-slug/
      evidence-manifest.md
      screenshot-01-meaningful-name.png
      screenshot-02-meaningful-name.png
      downloaded-output-or-reference.ext
```

## Workspace Notes

Use workspace notes only when useful:

```text
docs/agents/testers/maya-chen/workspace/notes/
  YYYY-MM-DD-short-slug-live-notes.md
  YYYY-MM-DD-short-slug-debrief.md
```

Do not create workspace notes for every small thought if the formal reports already capture the learning.

## Naming Rules

- Use lowercase short slugs.
- Include the date.
- Name screenshots by what they prove, not by browser time alone.
- Keep generated media filenames as downloaded unless renaming is needed for clarity.
- Never include secrets, passwords, tokens, cookies, or raw auth state in filenames or file contents.

## Minimal Run Packet

Every completed run should have at least:

- Maya report.
- Engineering handoff.
- Reports index entry.
- Credit ledger update if credits were checked or spent.
- Admin publish status recorded.
- Self-score ledger row.

Generation runs should also have:

- Evidence manifest.
- Prompt text in the reports or handoff.
- Credit worksheet details or equivalent report notes.
- Output visibility/save/find-it-again result.

## Screenshot Retention Rule

Do not keep screenshots just because they were captured.

Keep only screenshots or downloads that show evidence needed to solve an issue, prove credit spend, prove output state, prove save/find-it-again behavior, or support another specific finding.

Delete, redact, or do not save screenshots that show account emails, billing details, credentials, tokens, cookies, private account state, or routine successful navigation that does not support a finding.
