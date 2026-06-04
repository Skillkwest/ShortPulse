# Standard Create Human Experience Model

Status: Pulse workspace draft, not source of truth.

Purpose: define the real human experience Standard Create is supposed to produce, using the current repo contract plus basic user psychology as the frame.

Primary source anchors:

- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
- `docs/sops/sop_ai_studio_agent.md`
- `docs/product/shortpulse_ai_studio.md`
- `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx`
- `frontend/features/ai-studio/components/create/StandardCreatePanelView.tsx`
- `frontend/features/ai-studio/createRuntime/buildStandardCreateRuntimeResult.ts`
- `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts`

## One Sentence

Standard Create should feel like a creative control surface where the user always understands what they are making, what text is currently in control, and what will happen next if they click `Generate`.

More specifically:

- `Chat mode on` should feel reminiscent of using ChatGPT in a strong conversational drafting mode.
- `Chat mode off` should feel like a unique ShortPulse-native power experience where LLM help and image generation controls live in one deliberate creation surface.

## Product Position

Standard Create is not a secondary utility panel.

It is:

- the first creative surface many users will encounter when they create a project
- the entry point into the creative space
- the psychological front door of the workflow
- the powerhouse of the broader creation system

That means the experience has to do two things at once:

- feel powerful enough to justify being the center of the workflow
- feel intuitive enough that users are not intimidated by that power

The user should feel:

`This is where I begin making things, and it already feels capable, clear, and welcoming.`

## The Human Promise

To a real user, Standard Create should not feel like:

- a hidden workflow
- a magic prompt mutator
- a mode that quietly turns into Pulse
- a chat toy disconnected from output
- a form that suddenly changes meaning mid-use

It should feel like:

- a stable place to think
- a place where the visible composer matters
- a place where the user can draft, refine, and then deliberately generate
- a system that rewards attention instead of punishing it
- a creative surface that feels central, not incidental

## Core Psychological Model

The user is trying to answer four questions, usually without saying them out loud:

1. `Where am I?`
2. `What is controlling the next output?`
3. `What happens if I press the main button right now?`
4. `Did the system preserve my intent, or did it reinterpret it?`

Standard Create works only when those four answers remain clear.

## First 60 Seconds

The first minute matters disproportionately because this is the user's entry point into the creative space.

In that first minute, the user should feel a progression like this:

1. `Arrival`
   - "I’m in the right place to make something."
   - The surface feels central and active, not like a setup screen.

2. `Comprehension`
   - "I can tell what this panel does."
   - The main controls and main text surface are legible without explanation.

3. `Permission`
   - "I can begin simply."
   - The user does not feel they must understand every control before starting.

4. `Discovery`
   - "There is more power here when I want it."
   - Extra capability feels available, not forced.

5. `Momentum`
   - "I can already move from idea to action."
   - The user feels forward motion quickly, not setup fatigue.

If the first minute feels dense, ambiguous, or overly operational, the panel may still be functional but the human experience will already be weaker than it should be.

## What Users Should Feel

### 1. Orientation

The user should feel immediately oriented.

- They are in `Create`.
- They are in `Standard`, not `Pulse`.
- The screen should read like a creation workspace, not a hidden agent runtime.
- The visible controls should explain the current mode without extra teaching.
- The panel should feel like the main stage of the experience, not a narrow setup form tucked inside a larger app.

### 2. Agency

The user should feel that the visible composer is authoritative.

- If they type into the visible Standard composer, that text should be the thing that matters.
- If the assistant suggests something, it should remain a suggestion until the user explicitly uses it.
- Generation should never appear to happen from hidden state the user cannot see.
- The user should feel that this surface is powerful because it obeys them clearly, not because it behaves mysteriously.

### 3. Predictability

The user should be able to predict the meaning of `Generate`.

- In chat-off Standard Create, `Generate` means "use my authored visible prompt and current controls."
- In chat-on Standard Create, the panel should stop pretending it is in direct-generate mode.
- The UI must make that difference legible by hiding the direct Create control set when chat mode is active.
- Simplicity here matters more than spectacle. The main action should feel obvious, not theatrical.

### 4. Trust

The system should feel like it preserves intent rather than hijacking it.

- No silent prompt swaps.
- No silent carryover from Pulse.
- No hidden mode leakage.
- No output generated from stale or invisible text.

## Power Without Intimidation

This is one of the central design tensions of Standard Create.

The panel should feel:

- capable without being cluttered
- advanced without being academic
- deep without being confusing
- strong without being loud

Psychologically, users should feel:

- "There is a lot I can do here."
- not "I need to understand a complicated machine before I’m allowed to begin."

That means the design should prefer:

- strong defaults
- clear main actions
- understandable mode differences
- visible authority
- progressive discovery of deeper capability

The experience fails if power is achieved mainly through opacity.

## Progressive Depth

Standard Create should reveal its power in layers.

### Layer 1: Immediate use

At first glance, a user should be able to:

- type
- drop an image
- understand the current mode
- click the main action when appropriate

This layer should feel simple and approachable.

### Layer 2: Guided creative help

As the user leans in, they should discover:

- conversational brainstorming
- prompt refinement
- image-aware reasoning in chat mode
- style, model, and character-related creative leverage

This layer should feel helpful and expansive.

### Layer 3: Skilled control

With more use, the user should feel they can deliberately shape outcomes through:

- prompt precision
- model choice
- generation-ready versus chat-first stance
- references, attachments, and creative iteration

This layer should feel professional without becoming brittle.

The ideal experience is:

`easy to start, rewarding to continue, and deeper than it first appears.`

## The Two Standard Experiences

Standard Create is really two human experiences under one roof.

### Standard Chat Mode Off

This is the `direct creation` experience.

What the user expects:

- "I am setting up a generation."
- "These controls affect the next output."
- "The visible prompt is the prompt."
- "Generate is the primary action."

Psychological read:

- higher control
- lower ambiguity
- stronger sense of authorship
- more tool-like than assistant-like

This mode should feel like a confident creative workstation, but more powerful than a normal image-generation form.

The user experience target here is:

- not just "fill out a prompt and click generate"
- not just "talk to an assistant"
- but "use an LLM and image generation together in one integrated making surface"

In this mode, the user should feel they are using a uniquely capable tool:

- they can think with language
- shape intent deliberately
- use rich controls
- and convert that intent into generation without leaving the same mental workspace

This is where the panel should feel like the `powerhouse` of the workflow:

- deep capability
- direct leverage
- strong sense of forward motion
- no unnecessary friction between idea and output

This is the part of Standard Create that should feel distinctively stronger than ordinary chat and stronger than ordinary image forms.

### Standard Chat Mode On

This is the `guided drafting and refinement` experience.

What the user expects:

- "I am talking through ideas."
- "The assistant can help me write or improve text."
- "I can bring visuals directly into this conversation and think with them."
- "We are not yet in the same direct-generate state as the control-heavy mode."
- "If I want assistant text to become the active generation input, I must do that deliberately."

Psychological read:

- higher exploration
- higher ambiguity tolerance
- more conversational
- still anchored in visible user control

This mode should feel reminiscent of ChatGPT at its best:

- natural to type into
- responsive
- idea-friendly
- good at helping the user think, rephrase, refine, and expand

It should also feel visually creative, not text-only.

The user should be able to:

- drag and drop images into the composer
- have the agent reason about those visuals
- brainstorm from them
- develop prompt ideas from them
- compare, reinterpret, and evolve visual intent through conversation

So `Chat Mode On` is not just a writing helper. It is a capable creative thinking lane that can work with images and language together inside the same conversational surface.

But it still needs one important Standard Create difference:

- the conversation is happening inside a creation workspace
- the user is still ultimately steering toward usable generation input
- assistant output remains help, not hidden authority

So the feeling should be:

`ChatGPT-like conversational ease, but still grounded in a visible creation surface.`

## Mode Transition Psychology

Switching between `Chat Mode On` and `Chat Mode Off` should not feel like falling into two unrelated tools.

It should feel like changing stance within the same creative surface:

- `Chat Mode On`: "Help me think."
- `Chat Mode Off`: "Help me execute."

The user should feel continuity of place, but clarity of posture.

The transition should communicate:

- the workspace is still the same
- the creative goal is still the same
- the active way of working has changed

If the transition feels like a hidden tool swap, the user has to mentally reorient too hard. If it feels identical despite different behavior, the user gets confused about what `Generate` or the assistant actually mean in each mode.

So the ideal transition is:

`same space, different stance, clear consequences.`

## The Most Important Behavioral Truth

Standard Create should preserve a simple mental model:

`Only the text the user can see and intentionally use should control generation.`

That is the emotional and cognitive center of the lane.

Everything else is support.

## Why The Inline Generate CTA Matters

The Generate button is not just a control. It is a promise.

To the user, it says:

- "This is the main action."
- "The screen is currently in generate-ready mode."
- "The thing on screen is what will be used."

That is why hiding it in Standard chat mode matters. If chat mode left the same direct-generate affordance visible, users would naturally assume the system was still in the same cognitive state even when it was not.

## Visual Thinking

Standard Create should support not just textual creativity, but visual thinking.

This matters especially in `Chat Mode On`.

When users drag and drop images into the composer, they are not merely attaching files. Psychologically, they are doing something closer to:

- "Look at this with me."
- "Help me think from this."
- "Turn this visual into direction."
- "Help me reinterpret what I’m seeing."

That means image attachment inside the chat composer should feel like an expansion of thought, not just a technical upload step.

The agent should feel capable of:

- seeing the image as creative context
- helping the user name what matters in it
- extracting angles, mood, composition, or prompt potential
- brainstorming transformations or new prompt directions from it

This is one of the strongest reasons `Chat Mode On` can be a serious creative lane rather than a simple assistant overlay.

## Why Pulse Separation Matters Psychologically

Most users will never think in terms like `runtime isolation`.
They will think in terms like:

- "Why is this acting weird now?"
- "Did it remember something from the other mode?"
- "Why did it suddenly become more guided?"
- "Why is it responding like a different tool?"

If Standard inherits Pulse behavior, the user experiences that as personality drift, unexplained statefulness, and loss of trust.

So the technical rule `no Standard/Pulse leakage` maps directly to a human rule:

`The tool should not feel like it changed identity behind the user's back.`

## What A User Should Be Able To Learn Implicitly

Without reading docs, a user should be able to learn:

- Standard is the normal creative workspace.
- Chat mode is for help thinking, drafting, and working creatively with both words and images.
- Chat-off mode is for direct controlled generation.
- Pulse is a different kind of agent lane.
- Switching modes does not erase the shared workspace, but it does change who owns the active conversational behavior.

If a user cannot learn those rules from interaction alone, the experience is psychologically muddy.

## Red Lines

Standard Create should not:

- auto-apply assistant text into the active generation prompt without a deliberate user action
- behave as though hidden conversation state is more real than visible composer state
- leave direct-generate controls visible when the user is actually in chat-first mode
- leak Pulse transcript, workflow, preset, or draft behavior into the Standard surface
- make the user wonder whether `Generate` is using the visible prompt or some internal alternate prompt

## Failure Experience Requirements

When something goes wrong, the user should still feel oriented.

Failures should preserve:

- draft visibility
- mode clarity
- action clarity
- confidence that the system did not silently mutate the prompt

The user should feel:

- "That failed."
- not "What state am I in now?"

## Failure Without Collapse

The deeper psychological requirement is that failure should not collapse the user's sense of momentum.

After a failure, the user should still feel:

- "My idea is intact."
- "My draft is still mine."
- "I know what to do next."
- "The tool is still working with me, not against me."

That means Standard Create should fail in ways that preserve:

- authorship
- continuity
- confidence
- next-step clarity

A good failure state does not merely report the error. It protects the creative thread.

## Product Interpretation

Standard Create is best understood as:

- the main creative entry point of the product
- a visible-authority lane
- a deliberate generation lane
- a conversationally assisted lane when requested
- a non-Pulse-shaped lane
- a dual-mode creative system where:
  - chat-on feels familiar and ChatGPT-like
  - chat-off feels uniquely powerful because language intelligence and generation controls are fused together

Its job is not to be flashy for its own sake.
Its job is to make the user feel:

- capable
- in control
- creatively energized
- unsurprised by the system
- welcomed into a powerful workspace that still feels simple to use

## Working Summary

If Standard Create is functioning correctly, the user should leave with this impression:

`I knew where I was, I knew what text mattered, and the system only generated from what I intentionally put in control.`

And at a higher emotional level:

`This felt like the real center of the creative workflow: powerful, clear, and easy to step into.`

If that impression breaks, the Standard Create experience is psychologically broken even if the code still "works."
