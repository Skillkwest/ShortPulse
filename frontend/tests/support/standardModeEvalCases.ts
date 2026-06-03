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
    historicalUserGoalsIncludes?: string[];
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
        "Answered follow-up: Which audience should this target first? -> Adults 25-34.",
        "A reusable prompt is available.",
        "The current prompt source is references.",
      ],
    },
  },
  {
    id: "historical-goal-recall-across-window",
    goal: "Recall an older substantive user goal when the recent transcript window mostly contains follow-up answers.",
    input: {
      messages: [
        createMessage({
          id: "user-goal-1",
          role: "user",
          content: "Help me shape a premium skincare launch campaign for adults 25-34.",
        }),
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "Should the tone feel more clinical or more luxurious?",
        }),
        createMessage({ id: "user-2", role: "user", content: "More luxurious." }),
        createMessage({
          id: "assistant-2",
          role: "assistant",
          content: "What should the hero visual emphasize?",
        }),
        createMessage({ id: "user-3", role: "user", content: "Texture." }),
        createMessage({ id: "assistant-3", role: "assistant", content: "Any color direction?" }),
        createMessage({ id: "user-4", role: "user", content: "Warm neutrals." }),
        createMessage({ id: "assistant-4", role: "assistant", content: "Should copy be minimal?" }),
        createMessage({ id: "user-5", role: "user", content: "Yes." }),
        createMessage({
          id: "assistant-5",
          role: "assistant",
          content: "What audience should this target first?",
        }),
        createMessage({ id: "user-6", role: "user", content: "Adults 25-34." }),
      ],
      latestPromptArtifact:
        "Luxury skincare launch campaign with warm neutral palette and tactile product textures",
      promptOrigin: "reference",
    },
    expect: {
      lastAcceptedPrompt:
        "Luxury skincare launch campaign with warm neutral palette and tactile product textures",
      nextBestAction: "Refine or generate from the accepted prompt.",
      currentTask: "Help me shape a premium skincare launch campaign for adults 25-34.",
      historicalUserGoalsIncludes: [
        "Help me shape a premium skincare launch campaign for adults 25-34.",
      ],
      openQuestions: [],
      decisionsMadeIncludes: [
        "Answered follow-up: What audience should this target first? -> Adults 25-34.",
        "Answered follow-up: Should copy be minimal? -> Yes.",
        "Answered follow-up: Any color direction? -> Warm neutrals.",
        "A reusable prompt is available.",
        "The current prompt source is references.",
      ],
    },
  },
  {
    id: "short-imperative-pivot-stays-active",
    goal: "Keep a short imperative pivot as the active task instead of collapsing back to older goals.",
    input: {
      messages: [
        createMessage({
          id: "user-1",
          role: "user",
          content: "Help me shape a premium skincare launch campaign for adults 25-34.",
        }),
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "What audience should this target first?",
        }),
        createMessage({ id: "user-2", role: "user", content: "Make it darker." }),
      ],
      latestPromptArtifact:
        "Luxury skincare launch campaign with warm neutral palette and tactile product textures",
      promptOrigin: "reference",
    },
    expect: {
      lastAcceptedPrompt:
        "Luxury skincare launch campaign with warm neutral palette and tactile product textures",
      nextBestAction: "Refine or generate from the accepted prompt.",
      currentTask: "Make it darker.",
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
      "Use the conversation's Standard session memory to preserve active goals, constraints, and accepted prompt direction, but do not quote that memory block verbatim.",
      "When the latest user turn already gives enough direction to continue, prefer a concrete refinement over another clarifying question.",
      "The previous assistant turn ended with a question, but the latest user turn is a direct revision request. Apply that revision to the current direction instead of treating it like a short answer.",
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
      "Use the conversation's Standard session memory to preserve active goals, constraints, and accepted prompt direction, but do not quote that memory block verbatim.",
      "The user is focused on image material. Ground the reply in what the image references imply for composition, style, or subject treatment.",
      "The user likely wants descriptive help, not an automatic rewrite into a generation prompt.",
    ],
  },
  {
    id: "describe-image-attribute-direct-answer",
    goal: "Treat a harmless visible image-attribute question as direct descriptive help, not a prompt-writing turn.",
    messages: [createMessage({ role: "user", content: "What color is her top?" })],
    context: {
      modeHint: "describe",
      focusedSource: "image",
      references: [{ id: "ref-image-2", kind: "image", caption: "Black dress portrait reference" }],
      media: [
        {
          id: "ref-image-2",
          kind: "image",
          url: "https://example.com/portrait-reference.png",
          thumbnailAlt: "Portrait reference",
        },
      ],
    },
    expectedSystemPromptSnippets: [
      "Standard reply behavior:",
      "Answer the user's latest message directly before offering optional next help.",
      "Focused source: image",
      "The user is focused on image material. Ground the reply in what the image references imply for composition, style, or subject treatment.",
      "The user likely wants descriptive help, not an automatic rewrite into a generation prompt.",
    ],
  },
  {
    id: "short-directive-pivot-refinement",
    goal: "Treat a short directive pivot as a real revision request even when the prior assistant turn asked a question.",
    messages: [createMessage({ role: "user", content: "Make it darker." })],
    context: {
      activePrompt:
        "Luxury skincare launch campaign with warm neutral palette and tactile product textures.",
      modeHint: "reference",
      focusedSource: "agent-output",
      lastAssistantMessage: "What audience should this target first?",
    },
    expectedSystemPromptSnippets: [
      "Standard runtime context:",
      "Mode hint: reference",
      "Focused source: agent-output",
      "Most recent assistant reply: What audience should this target first?",
      "When the latest user turn already gives enough direction to continue, prefer a concrete refinement over another clarifying question.",
      "The previous assistant turn ended with a question, but the latest user turn is a direct revision request. Apply that revision to the current direction instead of treating it like a short answer.",
      "The user is focused on prior assistant output. Build on that output directly instead of starting a new direction unless the latest user turn asks for one.",
      "A visible composer prompt already exists. If you improve it, preserve its core intent unless the user asks to change direction.",
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
      "Use the conversation's Standard session memory to preserve active goals, constraints, and accepted prompt direction, but do not quote that memory block verbatim.",
      "The user asked for multiple options. Provide 3 distinct options or directions before offering any follow-up question.",
      "Keep the turn conversational. Do not force the reply into a reusable prompt unless the user explicitly asks for one.",
    ],
  },
  {
    id: "simple-chat-compact-formatting",
    goal: "Keep a simple chat-mode ask compact and avoid over-structured formatting.",
    messages: [createMessage({ role: "user", content: "Summarize this in one sentence." })],
    context: {
      modeHint: "chat",
      lastAssistantMessage: "Here is the longer explanation of the current direction.",
    },
    expectedSystemPromptSnippets: [
      "Standard response formatting rules:",
      "Prefer a calm, readable response shape: short paragraphs first, then bullets or numbered lists only when the content is naturally grouped.",
      "Use a brief section label only when it clearly improves scanning. Most replies should not need headings.",
      "Avoid dense text walls, but do not over-structure the reply either.",
      "Answer the user's latest message directly before offering optional next help.",
      "Keep the turn conversational. Do not force the reply into a reusable prompt unless the user explicitly asks for one.",
    ],
  },
  {
    id: "prompt-critique-direct-judgment",
    goal: "Give a direct judgment first when the user asks for critique of prompt material already in play.",
    messages: [
      createMessage({ role: "user", content: "Is this too generic? How would you improve it?" }),
    ],
    context: {
      activePrompt: "Premium skincare campaign with elegant lighting and elevated copy.",
      modeHint: "reference",
      focusedSource: "agent-output",
      lastAssistantMessage: "Here is a first pass prompt direction.",
    },
    expectedSystemPromptSnippets: [
      "Standard runtime context:",
      "Mode hint: reference",
      "Focused source: agent-output",
      "Visible composer prompt: Premium skincare campaign with elegant lighting and elevated copy.",
      "The user is asking for evaluation or critique. Give a direct judgment first, then explain the strongest reasons, then offer the most useful improvement.",
      "The user is focused on prior assistant output. Build on that output directly instead of starting a new direction unless the latest user turn asks for one.",
      "A visible composer prompt already exists. If you improve it, preserve its core intent unless the user asks to change direction.",
    ],
  },
];
