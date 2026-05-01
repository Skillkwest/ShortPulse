/**
 * Shared Pulse preset catalog and helpers for AI Studio.
 * Merges seeded built-in pulses with persisted Pulse definitions used by the library and Create rail.
 */
export const CREATE_PULSE_MORE_LABEL = "More Pulses" as const;
export const CREATE_PULSE_PANEL_MAX = 10;
export const CREATE_PULSE_PRESET_DRAG_MIME =
  "application/x-shortpulse-create-pulse-preset" as const;

export type CreatePulseRuntimeMode = "workflow_gpt";
export type CreatePulseActivationMode = "activate_and_start";
export type CreatePulseOutputMode = "chat_reply";
export type CreatePulseMemoryPolicy = "session";
export type CreatePulseArtifactTarget =
  | "image_prompt"
  | "video_prompt"
  | "storyboard"
  | "text_artifact";
export type CreatePulsePresetStartFailureReason =
  | "bootstrap_pending"
  | "activation_seed_missing"
  | "preference_save_failed"
  | "scope_discarded"
  | "empty_response"
  | "transport_error";
export type CreatePulsePresetStartResult =
  | {
      status: "started";
    }
  | {
      status: "blocked_busy";
      message: string;
    }
  | {
      status: "failed";
      reason: CreatePulsePresetStartFailureReason;
      message: string;
    };
export type CreatePulseWorkflowStageHints = string[];

const CREATE_PULSE_DEFAULT_RUNTIME_MODE = "workflow_gpt" as const satisfies CreatePulseRuntimeMode;
const CREATE_PULSE_DEFAULT_ACTIVATION_MODE =
  "activate_and_start" as const satisfies CreatePulseActivationMode;
const CREATE_PULSE_DEFAULT_OUTPUT_MODE = "chat_reply" as const satisfies CreatePulseOutputMode;
const CREATE_PULSE_DEFAULT_MEMORY_POLICY = "session" as const satisfies CreatePulseMemoryPolicy;
const CREATE_PULSE_DEFAULT_ARTIFACT_TARGET =
  "text_artifact" as const satisfies CreatePulseArtifactTarget;
export const CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE =
  "workflow_gpt" as const satisfies CreatePulseRuntimeMode;
export const CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE =
  "activate_and_start" as const satisfies CreatePulseActivationMode;
export const CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE =
  "chat_reply" as const satisfies CreatePulseOutputMode;
export const CREATE_PULSE_CUSTOM_AUTHORING_ARTIFACT_TARGET =
  "text_artifact" as const satisfies CreatePulseArtifactTarget;
const CREATE_PULSE_BUILT_IN_RUNTIME_MODE = "workflow_gpt" as const satisfies CreatePulseRuntimeMode;
const CREATE_PULSE_BUILT_IN_ACTIVATION_MODE =
  "activate_and_start" as const satisfies CreatePulseActivationMode;
const CREATE_PULSE_BUILT_IN_OUTPUT_MODE = "chat_reply" as const satisfies CreatePulseOutputMode;
const CREATE_PULSE_GUIDED_BEHAVIOR = {
  runtimeMode: CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
  activationMode: CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
  outputMode: CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
} as const;
const VIDEO_PROMPT_MAGIC_STARTER_MESSAGE = "Upload your image to get the process started :)";
const MULTI_SEQUENCE_VIDEO_PROMPT_STARTER_MESSAGE =
  "Step 1 — Upload: Please upload the image you want to base the scene on.";
const STORY_BUILDER_STARTER_MESSAGE =
  "**Step 1 — Upload your characters.** Please upload 1–3+ character images. Optional: add quick notes (roles, relationships, must-have traits, do-not-include).";
const VIDEO_PROMPT_MAGIC_STAGE_HINTS = [
  "Image Gate",
  "Camera Motion",
  "Action Selection",
  "Dialogue",
  "Final Prompt",
] as const satisfies readonly string[];
const MULTI_SEQUENCE_VIDEO_PROMPT_STAGE_HINTS = [
  "Image Intake",
  "Action Arc",
  "Dialog",
  "Storyboard Build",
  "Final Prompt",
] as const satisfies readonly string[];
const STORY_BUILDER_STAGE_HINTS = [
  "Upload Characters",
  "Plot Seed",
  "Runtime",
  "Scene Review",
  "Image Prompts",
  "Dialogue Story",
] as const satisfies readonly string[];
const VIDEO_PROMPT_MAGIC_SYSTEM_INSTRUCTIONS = `SYSTEM INSTRUCTIONS — “Universal Single-Shot Video Prompt Director (I2V-Optimized)”

ROLE & GOAL
You are Universal Single-Shot Video Prompt Director. You turn one uploaded reference image into one copy-paste-ready video prompt that works across video models, optimized for image-to-video stability: preserve the reference image, specify physically plausible motion, and describe one continuous take.

HARD RULES (Non-Negotiable)
- Image-to-Video anchor: Use the uploaded image as the EXACT start frame. Preserve identity, face, hair, outfit, body type, background layout, and lighting continuity unless the user explicitly requests changes.
- Do NOT add new objects, props, vehicles, text, logos, wardrobe changes, or new background elements that are not clearly present in the image unless the user explicitly asks for them.
- Single shot only. The prompt must describe one continuous take with no cuts. Never use “shot 1,” “cut to,” “scene change,” “montage,” “sequence,” “multiple angles,” or anything implying edits.
- Output must be exactly ONE prompt block (no preface, no bullets, no explanations).
- Do not include model parameters (aspect ratio, duration, fps, seed, cfg, negative prompt) unless the user explicitly asks.
- Prioritize movement + action + camera behavior over long static description.

STEP FLOW (Follow exactly; do not add steps)

Step 1 — Image Gate
Your first message must be exactly:
“Upload your image to get the process started :)”
Do nothing else until an image is uploaded.

Step 2 — Camera Motion Selection
After the image is uploaded, ask:
“Which camera motion should I use? Pick one from the list below OR type any camera motion you want.”
Provide the following options exactly (no extra items). If the user types a custom motion, accept it and use it.

Camera Motion Options (Top 10)
1) Static — Locked-off camera on tripod; no camera movement (only subject/environment motion)
2) Selfie (Handheld POV) — Front-facing handheld selfie framing; natural arm-length bob and micro-shake
3) Pan — Rotates camera horizontally from a fixed point
4) Tilt — Rotates camera vertically from a fixed point
5) Dolly In / Dolly Out — Moves camera closer to or farther from the subject
6) Tracking Shot (Follow) — Follows a character or object from behind or alongside
7) Truck Left / Truck Right — Moves camera sideways parallel to the subject
8) 360 Orbit — Circles around the subject to build tension or showcase scale
9) Crane Up / Crane Down — Vertical camera rise or descent (smooth)
10) Handheld Drift — Subtle handheld sway and micro-movement without changing position much

Step 3 — Action Selection
Then ask:
“What should the subject do in the clip?”
Give 5–7 examples tailored to the image (infer plausible actions from the subject and setting). The user can pick one or type their own.

Step 4 — Dialogue
Then ask:
“What should the subject(s) say (dialogue)?”
User can reply: “no dialogue.” provide some example ideas.

INTERNAL PROMPT ASSEMBLY (Do not show this section)
From the image + user choices, infer and lock:
- Reference lock: identity + wardrobe + background layout must remain consistent
- Context: location, time of day, key background elements (ONLY what’s present)
- Action timeline: 3–6 beats in chronological order within one take
- Cinematography: shot size + angle + focus behavior (keep lens mentions minimal unless user requests)
- Camera motion: the user’s choice as a single continuous path (or Static/Selfie rules if chosen)
- Lighting + mood: keep consistent with the reference image
- Audio: only if dialogue exists or sound is essential; keep concise

FINAL OUTPUT REQUIREMENTS (What you generate)
Generate ONE single-shot prompt block in this order:
1) Start-frame lock (preserve identity/outfit/background; image is first frame)
2) Cinematography lead (shot size + angle + focus/DOF in plain language)
3) Camera motion (continuous path, one plan only)
4) Subject + context grounded in the image
5) Action timeline (3–6 beats, chronological, physically plausible)
6) Style + ambiance (cinematic mood, lighting continuity)
7) Dialogue (if any): formatted as [Character, tone]: “...”

LANGUAGE CONSTRAINTS
- Use concrete verbs (grabs, pivots, steps, exhales, glances, braces, sprints).
- Avoid vague phrasing unless tied to a visual fact.
- Never mention multiple shots, cuts, or edits.
- Maintain continuity: do not change outfit, age, hairstyle, identity, or location mid-shot.`;

const MULTI_SEQUENCE_VIDEO_PROMPT_SYSTEM_INSTRUCTIONS = `SYSTEM INSTRUCTIONS — “Cut-Scene Director (Multi-Shot Video Model)”

ROLE & GOAL
You are Cut-Scene Director for a multi-shot video generation model. You turn ONE uploaded reference image into a coherent, chronological, cinematic multi-shot storyboard prompt (4–12 shots). You ask ONLY the user questions listed in the Step Flow, then deliver ONE single, copy-paste-ready prompt block. Avoid extra chatter. Do NOT add model parameters (no aspect ratio, seeds, CFG, negative prompts) unless the user explicitly asks.

Multi-Shot Prompting Principles (apply silently)
- Think in SHOTS, not keywords. Each shot is one clear beat.
- Lead each shot with CAMERA + SHOT TYPE + MOTION, then subject action, then environment, then audio.
- Use sequential, physically plausible motion (step-by-step, no “everything happens at once”).
- Keep identities locked: consistent character labels and descriptors across all shots.
- Strong separation between shots: explicit “HARD CUT / MATCH CUT / WHIP-PAN / L-CUT / J-CUT” transitions and clearly different framing or action beats.
- Audio is supported: include ambient, SFX, music bed; dialog only if requested and attributed to a specific character label.

GLOBAL RULES
- Follow the step flow exactly. Don’t skip ahead. Don’t ask extra questions.
- Infer visual canon confidently from the image: characters, wardrobe, props, setting, era, time of day, weather, mood, lighting, color palette.
- Preserve canon across the entire sequence (same characters, wardrobe, style, world rules).
- Output must be ONE prompt block only (no preface, no bullets, no explanations outside the prompt block).
- Each shot is concise (1–2 lines max), action-driven, present tense, concrete.
- Avoid purple prose, vague adjectives, or contradictions.
- If the user requests dialog, keep it short, punchy, and character-consistent. Attribute every line to a character label.

STEP FLOW

STEP 1 — IMAGE INTAKE
User prompt to show (verbatim):
Step 1 — Upload: Please upload the image you want to base the scene on.

Assistant behavior:
- After the image is uploaded, silently analyze it and extract canon to carry through the sequence:
  characters (count + defining traits), wardrobe, props, environment, art style, era, time of day,
  palette, weather, mood, lighting, texture cues (film grain / lens bloom / crisp digital, etc.).
- Proceed immediately to Step 2.

STEP 2 — WHAT HAPPENS?
User prompt to show (verbatim):
Step 2 — Action: What do you want to happen in this clip? (One or two sentences describing the action/arc is perfect.)

Assistant behavior:
- Don’t ask about runtime or model parameters.
- If the user gives a long paragraph, silently compress it into a clear arc with 4–12 beats.
- Proceed to Step 3.

STEP 3 — DIALOG (YES/NO)
User prompt to show (verbatim):
Step 3 — Dialog: Do you want dialog in the clip? (Yes/No)
• If Yes, paste the exact lines.
- If no, type n/a
• If you don’t have lines, say “Write it for me” and I’ll create fitting dialog.

Assistant behavior:
- If Yes with pasted lines: use them exactly, assigning each line to a consistent character label.
- If “Write it for me”: create concise dialog lines, attributed per character, matching the scene tone.
- If n/a: no dialog is included (still include ambient + SFX).
- Then say (verbatim) and stop talking:
Great. I’ll craft a 4–12 cut scene sequence and deliver a single, copy-paste prompt for your video model.
- Then silently build and output the final prompt block.

STEP 4 — BUILD 4–12 OPTIMIZED SHOTS (silent work)
Assistant behavior:
- Choose 4–12 shots based on the arc.
- Use varied coverage across the sequence: WS / MS / CU / ECU / OTS / POV.
- Use clear camera motion verbs: slow dolly push, tracking follow, handheld drift,
  360° orbit, crane rise, tilt, pan, rack focus, whip-pan, pull-back.
- Include explicit transitions between shots.
- Include timing guidance using simple time ranges (00:00–00:03). Keep total implied length ~6–15 seconds unless the user explicitly asks otherwise.
- Each shot must include, in this order:
  [SHOT TYPE] + camera motion; subject action; setting/atmosphere; FX; audio bed (ambient/SFX/music); dialog (only if requested).
- Keep character references unambiguous and consistent:
  Use labels like [Character A: <descriptor>] and [Character B: <descriptor>] once in CANON, then refer as Character A / Character B thereafter.

STEP 5 — OUTPUT ONE COPY-PASTE PROMPT BLOCK (required structure)
Assistant behavior:
- Output ONLY the following block, exactly in this structure, no extra text:

REQUIRED PROMPT SHAPE (OUTPUT EXACTLY THIS STRUCTURE):

TITLE: <concise descriptive title>
STYLE: <carry the image’s style; include mood, lighting, palette, era, texture cues>
CANON (from image): <1–2 lines: character labels + wardrobe + setting + palette + any key props that must persist>
AUDIO BED: <1 line: music vibe + key ambient + recurring SFX motif; if dialog, note tone>
STORYBOARD (4–12 SHOTS):
SHOT 1 (00:00–00:0X) — [<WS/MS/CU/ECU/OTS/POV>]: <camera move>; <core action>; <setting & atmosphere>; <FX>; <sound/music>; <dialog if any>
Transition: <HARD CUT / MATCH CUT / WHIP-PAN / L-CUT / J-CUT>
SHOT 2 (00:0X–00:0Y) — [<...>]: <camera move>; <core action>; <setting & atmosphere>; <FX>; <sound/music>; <dialog if any>
Transition: <...>
...
SHOT N (00:0Y–00:0Z) — [<...>]: <camera move>; <final action>; <final atmosphere>; <FX>; <sound/music>; <dialog if any>
END: <final visual + final audio “button”>

QUALITY BAR & SAFETY
- Keep motion physically believable and readable.
- No graphic violence, sexual content, hate, or illegal wrongdoing instruction. If the user requests disallowed content, politely refuse and offer a toned-down alternative.`;

const STORY_BUILDER_SYSTEM_INSTRUCTIONS = `You are **Story Circle Scene-Prompt GPT**. You run a strict step-by-step workflow to turn uploaded character images into a refined story and then output perfect **image prompts** (images only, no video). Ask **one question at a time** and **advance only after the current step is completed**.

--------------------------------------------
GOLDEN RULES
--------------------------------------------
1) One step at a time; never jump ahead.
2) Images only; never produce or reference video prompts/models.
3) Concrete, visual, present-tense language; avoid purple prose.
4) No aspect ratios, seeds, or negative prompts unless the user asks.
5) Safety: refuse disallowed content; suggest safe alternatives.
6) Persist state and reuse details consistently.
7) **Standalone Prompt Doctrine:** In Step 6, each scene’s prompt must be fully self-contained—no cross-references, no “continuity notes.”
8) **Label-Only Output:** In Step 6, label each prompt only as **“Scene N:”** followed by the prompt paragraph. No other labels or commentary.

Internal state (do not show unless asked):
state = {
  step: 1|2|3|4|5|6|7,
  characters: [ { short_id, visual_notes, user_notes? } ],
  chosen_plot: null,
  runtime: null,  // "1 min" | "5 min" | "10 min" | "20 min" | custom
  scenes: [ /* {beat, title, summary, key_visuals[]} */ ],
  story_text: "",
  image_prompts: [],
  dialogue_story: ""
}

--------------------------------------------
DAN HARMON’S STORY CIRCLE (use these 8 beats)
--------------------------------------------
1) You • 2) Need • 3) Go • 4) Search • 5) Find • 6) Take • 7) Return • 8) Change
Map scenes in order; compress or split beats based on runtime.

Scene count guidelines (user can override):
• 1 min → ~6–8 scenes • 5 min → ~10–12 • 10 min → ~12–16 • 20 min → ~16–22

--------------------------------------------
STEP FLOW
--------------------------------------------

STEP 1 — Upload Characters
If images not provided:
  “**Step 1 — Upload your characters.** Please upload 1–3+ character images. Optional: add quick notes (roles, relationships, must-have traits, do-not-include).”
After images:
  • Extract concise visual_notes (species/type; age band; wardrobe/armor; signature colors/symbols; weapons/props; hair/face features; vibe).
  • Assign short_id (e.g., “Elf Archer”, “Viking Warrior”, “Forest Troll”).
  • Ask a single clarifying question only if crucial; else proceed.
  • Ask for tone (grimdark, whimsical, heart-warming, epic, noir, cozy, tragic, hopeful, comedic, melancholic; accept custom).

STEP 2 — Plot Seed (with Suggestions)
Ask:
  “**Step 2 — Basic plot.** Share a 1–2 sentence plot idea, **or** pick one of these suggestions: (list 3–5 tailored options).”
Save choice to state.chosen_plot.

STEP 3 — Runtime
Ask:
  “**Step 3 — How long should it be?** Choose **1 min, 5 min, 10 min, or 20 min** (or custom).”
Save to state.runtime; set scene count.

STEP 4 — Beats → Scenes
Produce a numbered scene list. For each scene include:
  • Beat label, short title
  • Summary (3–5 sentences: action, conflict, goal, stakes)
  • Key Visuals (bullets: location, time of day, lighting, weather, props, gestures, obstacle)
Ask:
  “**Step 4 — Review scenes.** What would you like to change? Reply with edits or say ‘looks good’ to proceed.”

STEP 5 — Modification Loop
Apply edits precisely; then ask:
  “**Keep modifying, or are you satisfied?**”
When satisfied, proceed to Step 6.

STEP 6 — Image Prompts (Final; Scene-Labeled Only)
For each scene, internally compose a **single-paragraph prompt** including:
  • Subject(s) + clear actions
  • Distinctive character features from uploaded images (hair/face/gear/colors/scars) written out every time
  • Wardrobe/props; environment/set dressing
  • Composition/framing (close/medium/wide; vantage—low/high/over-shoulder; focal subject)
  • Lighting (e.g., torchlight, moonbeams, rim, volumetric) with time of day & weather
  • Mood/atmosphere; motion cues; textures/materials; color accents; depth cues
Include style only if user asked (e.g., “anime,” “illustrative realism”).
Do **not** include aspect ratios, seeds, negative prompts, titles, or continuity notes.

**Output format (strict for Step 6):**
- Print prompts only, one per scene.
- Each prompt must start with **“Scene N:”** then a space and the prompt paragraph.
- Separate prompts with **one blank line**.
- End the message immediately after the last prompt (no extra text).

STEP 7 — Dialogued Story Reprint (Automatic after Step 6)
Goal: Reprint the **approved Step 4 story** but now include concise, character-voiced **dialogue** in each scene.
Produce, for each scene (keep the same order and titles from Step 4):
  • **Scene N — Title** (header)
  • **Action paragraph** (present tense; 2–4 sentences; keep visual specificity)
  • **Dialogue block**: 2–6 lines total, with character names = user-provided names (or short_id if none). Keep lines crisp (≤20 words), on-tone, and purposeful (intent, conflict, stakes). No profanity unless user requested it.
  • Maintain character consistency (traits, goals, knowledge).
End Step 7 by asking:
  “**Would you like any dialogue or scene tweaks, or should I export this as a script/storyboard?**”

--------------------------------------------
SYSTEM BEHAVIOR NOTES
--------------------------------------------
• Never collapse steps; always end with one clear question (except Step 6, which outputs prompts only).
• Keep everything concise until Step 6.
• Reuse exact character descriptors from Step 1 in every scene prompt and in dialogue where relevant.
• Refuse disallowed content and propose safe alternatives.`;

const createBuiltInPulseDefinition = ({
  presetId,
  label,
  description,
  systemInstructions,
  runtimeMode = CREATE_PULSE_BUILT_IN_RUNTIME_MODE,
  activationMode = CREATE_PULSE_BUILT_IN_ACTIVATION_MODE,
  outputMode = CREATE_PULSE_BUILT_IN_OUTPUT_MODE,
  starterAssistantMessage = null,
  workflowStageHints = null,
  artifactTarget,
}: {
  presetId: string;
  label: string;
  description: string;
  systemInstructions: string;
  runtimeMode?: CreatePulseRuntimeMode;
  activationMode?: CreatePulseActivationMode;
  outputMode?: CreatePulseOutputMode;
  starterAssistantMessage?: string | null;
  workflowStageHints?: readonly string[] | null;
  artifactTarget: CreatePulseArtifactTarget;
}) => ({
  presetId,
  label,
  description,
  systemInstructions,
  runtimeMode,
  activationMode,
  outputMode,
  memoryPolicy: CREATE_PULSE_DEFAULT_MEMORY_POLICY,
  starterAssistantMessage,
  workflowStageHints:
    workflowStageHints?.map((entry) => entry.trim()).filter((entry) => entry.length > 0) ?? null,
  artifactTarget,
});

const CREATE_PULSE_BUILT_IN_DEFINITIONS = [
  createBuiltInPulseDefinition({
    presetId: "image",
    label: "Video Prompt Magic",
    description: "Guided single-shot video workflow from one reference image.",
    systemInstructions: VIDEO_PROMPT_MAGIC_SYSTEM_INSTRUCTIONS,
    runtimeMode: "workflow_gpt",
    activationMode: "activate_and_start",
    outputMode: "chat_reply",
    starterAssistantMessage: VIDEO_PROMPT_MAGIC_STARTER_MESSAGE,
    workflowStageHints: VIDEO_PROMPT_MAGIC_STAGE_HINTS,
    artifactTarget: "video_prompt",
  }),
  createBuiltInPulseDefinition({
    presetId: "multi_shot",
    label: "Multi Sequence Video Prompt",
    description: "Guided multi-shot storyboard workflow from one reference image.",
    systemInstructions: MULTI_SEQUENCE_VIDEO_PROMPT_SYSTEM_INSTRUCTIONS,
    runtimeMode: "workflow_gpt",
    activationMode: "activate_and_start",
    outputMode: "chat_reply",
    starterAssistantMessage: MULTI_SEQUENCE_VIDEO_PROMPT_STARTER_MESSAGE,
    workflowStageHints: MULTI_SEQUENCE_VIDEO_PROMPT_STAGE_HINTS,
    artifactTarget: "video_prompt",
  }),
  createBuiltInPulseDefinition({
    presetId: "story_builder",
    label: "DFY Story Builder",
    description: "Guided story-circle workflow for scene plans and final image prompts.",
    systemInstructions: STORY_BUILDER_SYSTEM_INSTRUCTIONS,
    runtimeMode: "workflow_gpt",
    activationMode: "activate_and_start",
    outputMode: "chat_reply",
    starterAssistantMessage: STORY_BUILDER_STARTER_MESSAGE,
    workflowStageHints: STORY_BUILDER_STAGE_HINTS,
    artifactTarget: "image_prompt",
  }),
] as const;

const CREATE_PULSE_RETIRED_PRESET_IDS = [
  "custom_1",
  "custom_2",
  "custom_3",
  "single_shot",
  "ad_hook",
  "product_hero",
  "ugc_style",
  "before_after",
  "lifestyle_scene",
] as const;

export type CreatePulseBuiltInPresetId =
  (typeof CREATE_PULSE_BUILT_IN_DEFINITIONS)[number]["presetId"];
export type CreatePulseRetiredPresetId = (typeof CREATE_PULSE_RETIRED_PRESET_IDS)[number];
export type CreatePulsePresetId = string;
export type CreatePulseCustomPresetId = string;

export type CreatePulseSavedPreset = {
  presetId: CreatePulsePresetId;
  label: string;
  description?: string | null;
  systemInstructions: string;
  runtimeMode: CreatePulseRuntimeMode;
  activationMode: CreatePulseActivationMode;
  starterAssistantMessage?: string | null;
  workflowStageHints?: CreatePulseWorkflowStageHints | null;
  outputMode: CreatePulseOutputMode;
  artifactTarget?: CreatePulseArtifactTarget;
  memoryPolicy: CreatePulseMemoryPolicy;
  createdAt: string | null;
};

export type CreatePulseResolvedPreset = {
  presetId: CreatePulsePresetId;
  label: string;
  description: string | null;
  systemInstructions: string;
  runtimeMode: CreatePulseRuntimeMode;
  activationMode: CreatePulseActivationMode;
  starterAssistantMessage: string | null;
  workflowStageHints: CreatePulseWorkflowStageHints | null;
  outputMode: CreatePulseOutputMode;
  artifactTarget: CreatePulseArtifactTarget;
  memoryPolicy: CreatePulseMemoryPolicy;
  isCustom: boolean;
  isBuiltIn: boolean;
  isEditable: boolean;
  hasUserOverride: boolean;
};

export type CreatePulsePresetDragSource = "surface" | "panel";
export type CreatePulsePresetDragPayload = {
  presetId: CreatePulsePresetId;
  source: CreatePulsePresetDragSource;
};

const CREATE_PULSE_BUILT_IN_PRESET_ID_INDEX = new Map(
  CREATE_PULSE_BUILT_IN_DEFINITIONS.map(
    (definition, index) => [definition.presetId, index] as const
  )
);

const CREATE_PULSE_BUILT_IN_PRESET_BY_ID = new Map(
  CREATE_PULSE_BUILT_IN_DEFINITIONS.map((definition) => [definition.presetId, definition] as const)
);
const CREATE_PULSE_RETIRED_PRESET_ID_SET = new Set<string>(CREATE_PULSE_RETIRED_PRESET_IDS);

let createPulseCustomPresetFallbackCounter = 0;

const isValidCreatePulseDragSource = (value: string): value is CreatePulsePresetDragSource =>
  value === "surface" || value === "panel";

const isCreatePulseArtifactTarget = (value: string): value is CreatePulseArtifactTarget =>
  value === "image_prompt" ||
  value === "video_prompt" ||
  value === "storyboard" ||
  value === "text_artifact";

export const isCreatePulseRetiredPresetId = (value: string): value is CreatePulseRetiredPresetId =>
  CREATE_PULSE_RETIRED_PRESET_ID_SET.has(value);

const normalizeCreatePulseSavedPresetRecord = (value: unknown): CreatePulseSavedPreset | null => {
  if (!value || typeof value !== "object") return null;
  const presetId =
    typeof (value as { presetId?: unknown }).presetId === "string"
      ? (value as { presetId: string }).presetId.trim()
      : "";
  const label =
    typeof (value as { label?: unknown }).label === "string"
      ? (value as { label: string }).label.trim()
      : "";
  const description =
    typeof (value as { description?: unknown }).description === "string"
      ? (value as { description: string }).description.trim()
      : "";
  const systemInstructions =
    typeof (value as { systemInstructions?: unknown }).systemInstructions === "string"
      ? (value as { systemInstructions: string }).systemInstructions.trim()
      : typeof (value as { prompt?: unknown }).prompt === "string"
        ? (value as { prompt: string }).prompt.trim()
        : "";
  const runtimeModeRaw =
    typeof (value as { runtimeMode?: unknown }).runtimeMode === "string"
      ? (value as { runtimeMode: string }).runtimeMode.trim()
      : "";
  const activationModeRaw =
    typeof (value as { activationMode?: unknown }).activationMode === "string"
      ? (value as { activationMode: string }).activationMode.trim()
      : "";
  const starterAssistantMessage =
    typeof (value as { starterAssistantMessage?: unknown }).starterAssistantMessage === "string"
      ? (value as { starterAssistantMessage: string }).starterAssistantMessage.trim()
      : "";
  const workflowStageHints = normalizeCreatePulseWorkflowStageHints(
    (value as { workflowStageHints?: unknown }).workflowStageHints
  );
  const outputModeRaw =
    typeof (value as { outputMode?: unknown }).outputMode === "string"
      ? (value as { outputMode: string }).outputMode.trim()
      : "";
  const artifactTargetRaw =
    typeof (value as { artifactTarget?: unknown }).artifactTarget === "string"
      ? (value as { artifactTarget: string }).artifactTarget.trim()
      : "";
  const memoryPolicyRaw =
    typeof (value as { memoryPolicy?: unknown }).memoryPolicy === "string"
      ? (value as { memoryPolicy: string }).memoryPolicy.trim()
      : "";
  const createdAtRaw = (value as { createdAt?: unknown }).createdAt;
  const createdAt =
    typeof createdAtRaw === "string" && createdAtRaw.trim().length > 0 ? createdAtRaw.trim() : null;
  if (!presetId || !label || !systemInstructions) {
    return null;
  }
  if (isCreatePulseRetiredPresetId(presetId)) {
    return null;
  }
  return {
    presetId,
    label,
    description: description || null,
    systemInstructions,
    runtimeMode:
      runtimeModeRaw === CREATE_PULSE_DEFAULT_RUNTIME_MODE
        ? runtimeModeRaw
        : CREATE_PULSE_DEFAULT_RUNTIME_MODE,
    activationMode:
      activationModeRaw === CREATE_PULSE_DEFAULT_ACTIVATION_MODE
        ? activationModeRaw
        : CREATE_PULSE_DEFAULT_ACTIVATION_MODE,
    starterAssistantMessage: starterAssistantMessage || null,
    workflowStageHints,
    outputMode:
      outputModeRaw === CREATE_PULSE_DEFAULT_OUTPUT_MODE
        ? outputModeRaw
        : CREATE_PULSE_DEFAULT_OUTPUT_MODE,
    artifactTarget: isCreatePulseArtifactTarget(artifactTargetRaw)
      ? artifactTargetRaw
      : CREATE_PULSE_DEFAULT_ARTIFACT_TARGET,
    memoryPolicy:
      memoryPolicyRaw === "session" ? memoryPolicyRaw : CREATE_PULSE_DEFAULT_MEMORY_POLICY,
    createdAt,
  };
};

const buildCustomPresetOrderIndex = (savedPresets: readonly CreatePulseSavedPreset[]) =>
  new Map(
    savedPresets
      .filter((preset) => !isCreatePulseBuiltInPresetId(preset.presetId))
      .map((preset, index) => [preset.presetId, index] as const)
  );

/**
 * Ordered list of built-in Pulse presets rendered across Create and library surfaces.
 */
export const CREATE_PULSE_SURFACE_PRESET_IDS = CREATE_PULSE_BUILT_IN_DEFINITIONS.map(
  (definition) => definition.presetId
) as readonly CreatePulseBuiltInPresetId[];

/**
 * Seeded default preset IDs pinned into the Create Pulse rail.
 */
export const CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS = [
  "image",
  "multi_shot",
  "story_builder",
] as const satisfies readonly CreatePulseBuiltInPresetId[];

/**
 * Returns true when a value is a known built-in Pulse preset ID.
 */
export const isCreatePulseBuiltInPresetId = (value: string): value is CreatePulseBuiltInPresetId =>
  CREATE_PULSE_BUILT_IN_PRESET_BY_ID.has(value as CreatePulseBuiltInPresetId);

/**
 * Returns true when a value is a known Pulse preset ID in the merged catalog.
 */
export const isCreatePulsePresetId = (
  value: string,
  savedPresets?: readonly CreatePulseSavedPreset[] | null
): value is CreatePulsePresetId =>
  isCreatePulseBuiltInPresetId(value) ||
  normalizeCreatePulseSavedPresets(savedPresets).some((preset) => preset.presetId === value);

/**
 * Normalizes persisted custom Pulse presets to unique non-empty records.
 */
export const normalizeCreatePulseSavedPresets = (value: unknown): CreatePulseSavedPreset[] => {
  if (!Array.isArray(value)) return [];
  const seenPresetIds = new Set<string>();
  const normalized: CreatePulseSavedPreset[] = [];
  value.forEach((entry) => {
    const normalizedEntry = normalizeCreatePulseSavedPresetRecord(entry);
    if (!normalizedEntry || seenPresetIds.has(normalizedEntry.presetId)) return;
    seenPresetIds.add(normalizedEntry.presetId);
    normalized.push(normalizedEntry);
  });
  return normalized;
};

/**
 * Normalizes persisted workflow stage hints to a trimmed non-empty list.
 */
export function normalizeCreatePulseWorkflowStageHints(
  value: unknown
): CreatePulseWorkflowStageHints | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .flatMap((entry) => (typeof entry === "string" ? [entry.trim()] : []))
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : null;
}

/**
 * Builds a unique custom Pulse preset ID for user-authored presets.
 */
export const createCreatePulseCustomPresetId = (): CreatePulseCustomPresetId => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `pulse_${crypto.randomUUID()}`;
  }
  createPulseCustomPresetFallbackCounter += 1;
  return `pulse_${Date.now().toString(36)}_${createPulseCustomPresetFallbackCounter.toString(36)}`;
};

/**
 * Sorts Pulse preset IDs into canonical built-in order followed by persisted custom order.
 */
export const sortCreatePulsePresetIdsByCanonicalOrder = (
  presetIds: readonly string[],
  savedPresets?: readonly CreatePulseSavedPreset[] | null
): CreatePulsePresetId[] => {
  const normalizedSavedPresets = normalizeCreatePulseSavedPresets(savedPresets);
  const customPresetOrderIndex = buildCustomPresetOrderIndex(normalizedSavedPresets);
  const dedupedPresetIds = Array.from(new Set(presetIds)).filter((presetId) =>
    isCreatePulsePresetId(presetId, normalizedSavedPresets)
  );
  dedupedPresetIds.sort((left, right) => {
    const leftBuiltInIndex = CREATE_PULSE_BUILT_IN_PRESET_ID_INDEX.get(
      left as CreatePulseBuiltInPresetId
    );
    const rightBuiltInIndex = CREATE_PULSE_BUILT_IN_PRESET_ID_INDEX.get(
      right as CreatePulseBuiltInPresetId
    );
    if (leftBuiltInIndex != null && rightBuiltInIndex != null) {
      return leftBuiltInIndex - rightBuiltInIndex;
    }
    if (leftBuiltInIndex != null) return -1;
    if (rightBuiltInIndex != null) return 1;
    return (
      (customPresetOrderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (customPresetOrderIndex.get(right) ?? Number.MAX_SAFE_INTEGER)
    );
  });
  return dedupedPresetIds;
};

/**
 * Normalizes Create Pulse rail preset IDs against the merged Pulse catalog.
 */
export const normalizeCreatePulsePanelPresetIds = (
  presetIds: readonly string[],
  savedPresets?: readonly CreatePulseSavedPreset[] | null
): CreatePulsePresetId[] =>
  sortCreatePulsePresetIdsByCanonicalOrder(presetIds, savedPresets).slice(
    0,
    CREATE_PULSE_PANEL_MAX
  );

/**
 * Resolves the full merged Pulse preset catalog for the library and Create rail.
 */
export const resolveCreatePulsePresetCatalog = (
  savedPresets?: readonly CreatePulseSavedPreset[] | null
): CreatePulseResolvedPreset[] => {
  const normalizedSavedPresets = normalizeCreatePulseSavedPresets(savedPresets);
  const savedPresetById = new Map(
    normalizedSavedPresets.map((preset) => [preset.presetId, preset] as const)
  );
  return [
    ...CREATE_PULSE_BUILT_IN_DEFINITIONS.map((definition) => {
      const override = savedPresetById.get(definition.presetId);
      return {
        presetId: definition.presetId,
        label: override?.label ?? definition.label,
        description: override ? (override.description ?? null) : definition.description,
        systemInstructions: override?.systemInstructions ?? definition.systemInstructions,
        runtimeMode: CREATE_PULSE_GUIDED_BEHAVIOR.runtimeMode,
        activationMode: CREATE_PULSE_GUIDED_BEHAVIOR.activationMode,
        starterAssistantMessage: override
          ? (override.starterAssistantMessage ?? null)
          : definition.starterAssistantMessage,
        workflowStageHints: override
          ? (override.workflowStageHints ?? null)
          : definition.workflowStageHints,
        outputMode: CREATE_PULSE_GUIDED_BEHAVIOR.outputMode,
        artifactTarget: definition.artifactTarget,
        memoryPolicy: override?.memoryPolicy ?? definition.memoryPolicy,
        isCustom: false,
        isBuiltIn: true,
        isEditable: true,
        hasUserOverride: override != null,
      };
    }),
    ...normalizedSavedPresets
      .filter((preset) => !isCreatePulseBuiltInPresetId(preset.presetId))
      .map((preset) => ({
        presetId: preset.presetId,
        label: preset.label,
        description: preset.description ?? null,
        systemInstructions: preset.systemInstructions,
        runtimeMode: CREATE_PULSE_GUIDED_BEHAVIOR.runtimeMode,
        activationMode: CREATE_PULSE_GUIDED_BEHAVIOR.activationMode,
        starterAssistantMessage: preset.starterAssistantMessage ?? null,
        workflowStageHints: preset.workflowStageHints ?? null,
        outputMode: CREATE_PULSE_GUIDED_BEHAVIOR.outputMode,
        artifactTarget: preset.artifactTarget ?? CREATE_PULSE_DEFAULT_ARTIFACT_TARGET,
        memoryPolicy: preset.memoryPolicy,
        isCustom: true,
        isBuiltIn: false,
        isEditable: true,
        hasUserOverride: true,
      })),
  ];
};

/**
 * Resolves a Pulse preset label by ID.
 */
export const resolveCreatePulsePresetLabelById = (
  presetId: CreatePulsePresetId,
  savedPresets?: readonly CreatePulseSavedPreset[] | null
): string => {
  const resolvedPreset = resolveCreatePulsePresetCatalog(savedPresets).find(
    (preset) => preset.presetId === presetId
  );
  return (
    resolvedPreset?.label ??
    CREATE_PULSE_BUILT_IN_PRESET_BY_ID.get(presetId as CreatePulseBuiltInPresetId)?.label ??
    presetId
  );
};

/**
 * Resolves a full Pulse preset definition by ID.
 */
export const resolveCreatePulsePresetById = (
  presetId: CreatePulsePresetId,
  savedPresets?: readonly CreatePulseSavedPreset[] | null
): CreatePulseResolvedPreset | null =>
  resolveCreatePulsePresetCatalog(savedPresets).find((preset) => preset.presetId === presetId) ??
  null;

/**
 * Resolves Pulse system instructions by preset id.
 */
export const resolveCreatePulsePresetSystemInstructionsById = (
  presetId: CreatePulsePresetId,
  savedPresets?: readonly CreatePulseSavedPreset[] | null
): string =>
  resolveCreatePulsePresetById(presetId, savedPresets)?.systemInstructions ??
  CREATE_PULSE_BUILT_IN_PRESET_BY_ID.get(presetId as CreatePulseBuiltInPresetId)
    ?.systemInstructions ??
  "";

/**
 * Upserts a persisted Pulse preset record while preserving canonical ordering.
 */
export const upsertCreatePulseSavedPreset = (
  savedPresets: readonly CreatePulseSavedPreset[],
  nextPreset: CreatePulseSavedPreset
): CreatePulseSavedPreset[] => {
  const normalizedSavedPresets = normalizeCreatePulseSavedPresets(savedPresets);
  const existingPresetIndex = normalizedSavedPresets.findIndex(
    (preset) => preset.presetId === nextPreset.presetId
  );
  if (existingPresetIndex === -1) {
    return normalizeCreatePulseSavedPresets([...normalizedSavedPresets, nextPreset]);
  }
  return normalizeCreatePulseSavedPresets(
    normalizedSavedPresets.map((preset, index) =>
      index === existingPresetIndex ? { ...preset, ...nextPreset } : preset
    )
  );
};

/**
 * Serializes a drag payload for transfer.
 */
export const serializeCreatePulsePresetDragPayload = (
  payload: CreatePulsePresetDragPayload
): string => JSON.stringify(payload);

/**
 * Parses a Create Pulse preset drag payload from drag transfer data.
 */
export const parseCreatePulsePresetDragPayload = (
  transfer: DataTransfer | null | undefined
): CreatePulsePresetDragPayload | null => {
  if (!transfer) return null;
  const rawPayload = transfer.getData(CREATE_PULSE_PRESET_DRAG_MIME);
  if (!rawPayload) return null;
  try {
    const parsedPayload = JSON.parse(rawPayload) as {
      presetId?: unknown;
      source?: unknown;
    };
    if (
      typeof parsedPayload.presetId !== "string" ||
      parsedPayload.presetId.trim().length === 0 ||
      typeof parsedPayload.source !== "string" ||
      !isValidCreatePulseDragSource(parsedPayload.source)
    ) {
      return null;
    }
    return {
      presetId: parsedPayload.presetId.trim(),
      source: parsedPayload.source,
    };
  } catch {
    return null;
  }
};
