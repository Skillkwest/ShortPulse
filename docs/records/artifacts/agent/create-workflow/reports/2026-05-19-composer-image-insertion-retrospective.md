# Create Composer Image Insertion Retrospective

Date: 2026-05-19
Agent: Create Workflow
Surface: AI Studio Create composer image attachments

## What the operator actually wanted

- ChatGPT-style image insertion into the composer.
- Image exists only for the current chat session.
- No project persistence, storage promotion, or durable media coupling.
- Clear visible feedback while the image is staging.

## What was wrong with the earlier approach

- The lane was treated as a generalized durable media workflow instead of a chat-only ephemeral attachment workflow.
- Internal Reference Grid drags and browser-native drag payloads were not cleanly separated.
- `DataTransfer.files` was trusted too early, so internal drags that included a synthetic browser image file were misclassified as desktop uploads.
- Some fixes improved preview or send behavior locally without proving that production was taking the same runtime branch.

## Pivots that mattered

1. Narrow the contract.
   - Composer image attachments are ephemeral, chat-only, and image-only.

2. Separate display from submission authority.
   - The chip preview and model-send source have different lifetime and ownership requirements.

3. Snapshot the drag payload synchronously.
   - Rebuild a stable transfer-like object before async work.

4. Prefer app-owned structured hints over raw browser files.
   - Internal/reference/media-library payloads win before `DataTransfer.files`.

5. Add characterization coverage for degraded browser drags.
   - Structured payload + synthetic file
   - Internal payload + synthetic file
   - Media-library payload + synthetic file
   - Degraded hint-only reference drag + synthetic file

6. Add visible preparing state.
   - Insert a `preparing` image attachment immediately, then replace it with the ready attachment after staging completes.

## What ended up being signal vs noise

High signal:

- User feedback that the lane felt too complex.
- The requirement that the image should behave like a ChatGPT attachment.
- Evidence that desktop file drops worked while Reference Grid drags failed.
- The Style panel’s snapshot-first intake pattern.

Low signal:

- Repeated preview-only fixes without proving the source-classification branch.
- Durable storage recovery logic for a lane that should not be durable.
- Broad URL fallback expansion before the drag classification model was correct.

## Durable lesson

This was primarily a drag-intake boundary bug, not an image rendering bug.

For app-owned internal drags:

- snapshot first
- resolve structured/internal hints first
- treat raw browser files as fallback only
- keep the lane ephemeral unless the product contract explicitly requires persistence
