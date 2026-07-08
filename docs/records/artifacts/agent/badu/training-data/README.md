# Badu Training Data

Purpose: store safe, sanitized training examples from Badu accounting runs.

Use this folder for:

- decision episodes,
- recurring failure modes,
- sanitized row-shape examples,
- post-run lessons that are too concrete for general memory but useful for future training.

Do not store:

- raw credentials,
- cookies or auth tokens,
- card details,
- customer payment identities,
- full invoice PDFs with private account details,
- tax/legal filings.

Current files:

- `decision-episodes.jsonl`: one sanitized decision case per line.
