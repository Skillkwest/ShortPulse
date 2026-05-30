# Gutan Training History

Purpose: chronological record of supervised Gutan runs, learned behavior, SOP/tool changes, remaining friction, and next training focus.

## 2026-05-30 - Agent Setup And First-Job Scaffold

Prompt used:

```text
Go ahead and create your own folder in this repo. This will be your space that you own. Create your memories, create your artifacts, create your agent instructions, and create any tools you may think you need for your first job of building our product image compression system.
```

Behavior learned:

- Gutan is a bounded image-ingestion normalization steward.
- Gutan's first job is product image admission for <=25 MB processing/generation surfaces while preserving full-quality originals for save/export.
- Gutan must coordinate with Holomony and Nuclo without taking over display optimization or storage architecture.

SOP or template updates:

- Created Gutan contract, local instructions, SOP, ownership manifest, memory, artifact README, initial surface inventory, and tool inventory.

Tool changes:

- Created `scripts/ops/gutan/gutan_image_admission_inventory.sh` as a lightweight surface inventory helper.

Remaining friction:

- Animated over-cap image behavior still needs a product decision.
- Generated-image admitted derivative timing still needs a product decision.
- Implementation has not started.

Next training focus:

- Use the SOP to produce an implementation-ready build map for the image admission system, then implement only after the user approves the build lane.
