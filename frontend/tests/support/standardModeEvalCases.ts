/**
 * Standard mode eval case catalog.
 * Defines compact named regression scenarios for Standard memory and runtime reply behavior.
 */
import type { AgentAttachment, AgentContext, AgentMessage } from "../../prefabs/agent";
import type { PromptOrigin } from "../../features/ai-studio/logic/agentPromptOwnership";

/**
 * Named Standard-memory regression case.
 */
export type StandardMemoryEvalCase = {
  id: string;
  goal: string;
  input: {
    messages: AgentMessage[];
    latestPromptArtifact: string | null;
    promptOrigin: PromptOrigin;
    attachments?: AgentAttachment[];
  };
  expect: {
    lastAcceptedPrompt: string | null;
    nextBestAction: string | null;
    currentTask?: string | null;
    openQuestions?: string[];
    constraintsIncludes?: string[];
    referencesInPlayIncludes?: string[];
    decisionsMadeIncludes?: string[];
  };
};

/**
 * Named Standard-runtime reply regression case.
 */
export type StandardRuntimeEvalCase = {
  id: string;
  goal: string;
  messages: AgentMessage[];
  context: Partial<AgentContext>;
  expectedSystemPromptSnippets: string[];
};

const createMessage = (overrides: Partial<AgentMessage>): AgentMessage => ({
  id: overrides.id ?? "message-1",
  role: overrides.role ?? "user",
  content: overrides.content ?? "",
  ...overrides,
});

/**
 * Compact Standard-memory eval catalog for continuity and working-state behavior.
 */
export const STANDARD_MEMORY_EVAL_CASES: StandardMemoryEvalCase[] = [
  {
    id: "transcript-prompt-continuity",
    goal: "Recover the last accepted prompt from transcript history when explicit prompt state is absent.",
    input: {
      messages: [
        createMessage({ id: "user-1", role: "user", content: "Draft a premium portrait prompt." }),
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "Use this as your base.",
          outputPrompt: "Premium portrait in warm golden-hour light with editorial polish",
          canUseAsPrompt: true,
        }),
        createMessage({
          id: "user-2",
          role: "user",
          content: "Make it warmer and more cinematic.",
        }),
      ],
      latestPromptArtifact: null,
      promptOrigin: "agent",
    },
    expect: {
      lastAcceptedPrompt: "Premium portrait in warm golden-hour light with editorial polish",
      nextBestAction: "Refine or generate from the accepted prompt.",
      decisionsMadeIncludes: [
        "A reusable prompt is available.",
        "The current prompt source is the assistant.",
      ],
    },
  },
  {
    id: "reference-follow-up-memory",
    goal: "Carry forward open questions, attachment constraints, and reference signals for a follow-up turn.",
    input: {
      messages: [
        createMessage({ id: "user-1", role: "user", content: "Help me shape this ad concept." }),
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "Which audience should this target first?",
        }),
      ],
      latestPromptArtifact: "Luxury skincare launch campaign with soft diffusion lighting",
      promptOrigin: "reference",
      attachments: [
        {
          id: "prompt-1",
          kind: "prompt",
          text: "keep the copy elevated and concise; preserve the luxury tone",
          referenceId: "ref-prompt-1",
        },
        {
          id: "image-1",
          kind: "image",
          imageUrl: "https://example.com/reference-image.png",
          referenceId: "ref-image-1",
        },
      ],
    },
    expect: {
      lastAcceptedPrompt: "Luxury skincare launch campaign with soft diffusion lighting",
      nextBestAction: "Answer the assistant's open question before refining further.",
      currentTask: "Help me shape this ad concept.",
      openQuestions: ["Which audience should this target first?"],
      constraintsIncludes: ["keep the copy elevated and concise", "preserve the luxury tone"],
      referencesInPlayIncludes: [
        "2 selected references",
        "image attachments",
        "attached prompt references",
        "reference-authored prompt",
      ],
      decisionsMadeIncludes: [
        "A reusable prompt is available.",
        "The current prompt source is references.",
      ],
    },
  },
  {
    id: "answered-follow-up-keeps-broader-task",
    goal: "Treat a follow-up answer as resolved while preserving the broader task in working state.",
    input: {
      messages: [
        createMessage({ id: "user-1", role: "user", content: "Help me shape this ad concept." }),
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "Which audience should this target first?",
        }),
        createMessage({ id: "user-2", role: "user", content: "Adults 25-34." }),
      ],
      latestPromptArtifact: "Luxury skincare launch campaign with soft diffusion lighting",
      promptOrigin: "reference",
    },
    expect: {
      lastAcceptedPrompt: "Luxury skincare launch campaign with soft diffusion lighting",
      nextBestAction: "Refine or generate from the accepted prompt.",
      currentTask: "Help me shape this ad concept.",
      openQuestions: [],
      decisionsMadeIncludes: [
        "A reusable prompt is available.",
        "The current prompt source is references.",
      ],
    },
  },
];

/**
 * Compact Standard-runtime eval catalog for server-owned context and reply behavior guidance.
 */
export const STANDARD_RUNTIME_EVAL_CASES: StandardRuntimeEvalCase[] = [
  {
    id: "follow-up-agent-output-refinement",
    goal: "Continue a follow-up refinement turn instead of restarting when the user answers a prior question.",
    messages: [createMessage({ role: "user", content: "Make it warmer and more premium." })],
    context: {
      activePrompt: "Premium editorial portrait in soft golden-hour light.",
      modeHint: "reference",
      focusedSource: "agent-output",
      lastAssistantMessage: "Would you like this to feel softer or more dramatic?",
    },
    expectedSystemPromptSnippets: [
      "Standard reply behavior:",
      "Treat the latest user turn as a likely answer and continue from it instead of restarting the conversation.",
      "Reference mode is active. Use the referenced prompts or images when they are relevant",
      "The user is focused on prior assistant output. Build on that output directly instead of starting a new direction unless the latest user turn asks for one.",
      "A visible composer prompt already exists. If you improve it, preserve its core intent unless the user asks to change direction.",
    ],
  },
  {
    id: "describe-image-grounding",
    goal: "Keep descriptive image help grounded in image context without forcing a prompt rewrite.",
    messages: [
      createMessage({
        role: "user",
        content: "What visual cues should I preserve from this reference?",
      }),
    ],
    context: {
      modeHint: "describe",
      focusedSource: "image",
      references: [{ id: "ref-image-1", kind: "image", caption: "Editorial beauty reference" }],
      media: [
        {
          id: "ref-image-1",
          kind: "image",
          url: "https://example.com/editorial-reference.png",
          thumbnailAlt: "Editorial reference",
        },
      ],
    },
    expectedSystemPromptSnippets: [
      "Standard runtime context:",
      "Mode hint: describe",
      "Focused source: image",
      "Image reference count: 1",
      "The user is focused on image material. Ground the reply in what the image references imply for composition, style, or subject treatment.",
      "The user likely wants descriptive help, not an automatic rewrite into a generation prompt.",
    ],
  },
  {
    id: "chat-brainstorm-no-forced-prompt",
    goal: "Keep chat-mode brainstorming conversational rather than forcing a reusable prompt.",
    messages: [
      createMessage({ role: "user", content: "Brainstorm three stronger hooks for this idea." }),
    ],
    context: {
      modeHint: "chat",
      lastAssistantMessage: "Do you want this to feel more playful or more serious?",
    },
    expectedSystemPromptSnippets: [
      "Standard runtime context:",
      "Mode hint: chat",
      "Most recent assistant reply: Do you want this to feel more playful or more serious?",
      "Standard reply behavior:",
      "Keep the turn conversational. Do not force the reply into a reusable prompt unless the user explicitly asks for one.",
    ],
  },
];
