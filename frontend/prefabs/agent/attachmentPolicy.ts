/**
 * Shared Create-agent attachment count policy.
 * Keeps composer, client transport, and server runtime limits aligned.
 */

export const AGENT_IMAGE_ATTACHMENT_MAX_ITEMS = 10;
export const AGENT_PROMPT_ATTACHMENT_MAX_ITEMS = 10;
export const AGENT_ATTACHMENT_MAX_ITEMS =
  AGENT_IMAGE_ATTACHMENT_MAX_ITEMS + AGENT_PROMPT_ATTACHMENT_MAX_ITEMS;
export const AGENT_REFERENCE_MAX_ITEMS = 24;
export const AGENT_SELECTED_REFERENCE_MAX_ITEMS = AGENT_ATTACHMENT_MAX_ITEMS;
export const AGENT_THINKER_MAX_IMAGE_REFERENCES = AGENT_IMAGE_ATTACHMENT_MAX_ITEMS;
export const AGENT_THINKER_MAX_PROMPT_REFERENCES = 8;

export const AGENT_IMAGE_CAPACITY_MESSAGE = "You can attach up to 10 images per message.";
export const AGENT_PROMPT_CAPACITY_MESSAGE =
  "You can attach up to 10 prompt references per message.";
