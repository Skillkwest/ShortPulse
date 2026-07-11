/**
 * Standard Create send authorization tests.
 * Proves Chat Mode revocation survives asynchronous attachment preparation and
 * prevents cleared composer attachments from being restored.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentAttachment } from "../../../../../prefabs/agent";
import { prepareAgentImageAttachments } from "../attachmentPreparation";
import {
  runStandardCreateAgentSend,
  type RunStandardCreateAgentSendParams,
} from "../runStandardCreateAgentSend";

vi.mock("../attachmentPreparation", () => ({
  prepareAgentImageAttachments: vi.fn(),
}));

const prepareAgentImageAttachmentsMock = vi.mocked(prepareAgentImageAttachments);

const imageAttachment: AgentAttachment = {
  id: "image-1",
  kind: "image",
  imageUrl: "https://example.com/reference.png",
  submissionImageUrl: "https://example.com/reference.png",
  text: null,
  deliveryStatus: "ready",
  deliveryError: null,
};

const createHarness = () => {
  let authorized = true;
  let attachments: AgentAttachment[] = [imageAttachment];
  const sendToAgent = vi.fn();
  const removeMessageById = vi.fn(() => true);
  const setAgentAttachmentError = vi.fn();
  const setAgentAttachments: RunStandardCreateAgentSendParams["setAgentAttachments"] = (action) => {
    attachments = typeof action === "function" ? action(attachments) : action;
  };
  const params: RunStandardCreateAgentSendParams = {
    agentIsSending: false,
    agentBootstrapReady: true,
    agentUiBusyRef: { current: false },
    setAgentUiBusy: vi.fn(),
    agentSessionEnabled: true,
    setAgentSessionEnabled: vi.fn(),
    agentInput: "Describe the reference",
    setAgentInput: vi.fn(),
    agentAttachments: [imageAttachment],
    setAgentAttachments,
    setAgentAttachmentError,
    prompt: "Describe the reference",
    latestAgentPrompt: null,
    setLatestAgentPrompt: vi.fn(),
    sendToAgent,
    appendUserMessage: vi.fn(() => "optimistic-1"),
    updateMessageById: vi.fn(() => true),
    removeMessageById,
    getAgentContext: vi.fn(() => ({})),
    standardSessionMemory: undefined,
    trackAgentUiEvent: vi.fn(),
    lastAssistantMessage: null,
    notifyBootstrapPending: vi.fn(),
    preparedImageUrlCacheRef: { current: new Map() },
    setAgentOnlineLookupPending: vi.fn(),
    isSendAuthorized: () => authorized,
  };

  return {
    params,
    sendToAgent,
    removeMessageById,
    setAgentAttachmentError,
    revoke: () => {
      authorized = false;
      attachments = [];
    },
    getAttachments: () => attachments,
  };
};

describe("runStandardCreateAgentSend authorization", () => {
  beforeEach(() => {
    prepareAgentImageAttachmentsMock.mockReset();
  });

  it("does not dispatch images when Chat Mode is revoked during preparation", async () => {
    let finishPreparation!: (
      value: Awaited<ReturnType<typeof prepareAgentImageAttachments>>
    ) => void;
    prepareAgentImageAttachmentsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishPreparation = resolve;
        })
    );
    const harness = createHarness();

    const send = runStandardCreateAgentSend(harness.params);
    await vi.waitFor(() => expect(prepareAgentImageAttachmentsMock).toHaveBeenCalledTimes(1));
    harness.revoke();
    finishPreparation({
      ok: true,
      imageAttachmentIds: ["image-1"],
      preparedImageUrls: new Map([["image-1", "https://example.com/prepared.png"]]),
    });
    await send;

    expect(harness.sendToAgent).not.toHaveBeenCalled();
    expect(harness.removeMessageById).toHaveBeenCalledWith("optimistic-1");
    expect(harness.getAttachments()).toEqual([]);
    expect(harness.setAgentAttachmentError).not.toHaveBeenCalledWith(expect.any(String));
  });

  it("does not restore cleared attachments when an already-dispatched request is discarded", async () => {
    prepareAgentImageAttachmentsMock.mockResolvedValue({
      ok: true,
      imageAttachmentIds: ["image-1"],
      preparedImageUrls: new Map([["image-1", "https://example.com/prepared.png"]]),
    });
    let finishRequest!: (
      value: Awaited<ReturnType<RunStandardCreateAgentSendParams["sendToAgent"]>>
    ) => void;
    const harness = createHarness();
    harness.sendToAgent.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve;
        })
    );

    const send = runStandardCreateAgentSend(harness.params);
    await vi.waitFor(() => expect(harness.sendToAgent).toHaveBeenCalledTimes(1));
    harness.revoke();
    finishRequest({ response: null, actions: undefined, discarded: true });
    await send;

    expect(harness.getAttachments()).toEqual([]);
    expect(harness.removeMessageById).toHaveBeenCalledWith("optimistic-1");
  });
});
