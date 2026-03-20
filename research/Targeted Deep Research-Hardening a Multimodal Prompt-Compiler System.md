# Targeted Deep Research: Hardening a Multimodal Prompt-Compiler System

## Structured-output hardening for compiler IR

Treat your ShortPulse “prompt compiler” output as **intermediate representation (IR)**: a canonical, machine-valid object that (a) drives downstream image generation and (b) becomes the only thing you store as “truth.” The core hardening move is to make **schema adherence a contract**, not a best effort.

### Choosing the right structured-output mechanism

OpenAI’s Structured Outputs are explicitly positioned as the successor to JSON mode: both can produce valid JSON, but Structured Outputs are meant to enforce *schema adherence* rather than “JSON-shaped text.” citeturn6view2turn0search38turn0search29

OpenAI documents two primary ways to do this:

- **`response_format: { type: "json_schema", … }`** when you want the model to emit a structured response payload (your IR).
- **Function/tool calling** when you want the model to “call” a tool with a JSON-schema-defined argument object. citeturn6view2turn0search4

For a “prompt compiler,” the most stable production pattern is: **use `json_schema` for the compiler’s final IR**, and optionally use tool calling for internal pipeline actions (if you have any). This matches OpenAI’s distinction: `response_format` is “more suitable when you want to indicate a structured schema for use when the model responds to the user.” citeturn6view2

### “Strict mode” patterns and schema constraints that reduce drift

OpenAI’s Structured Outputs guide shows strict schema mode via `json_schema` and recommends Structured Outputs over JSON mode where possible. citeturn6view2turn0search38

Key schema techniques that consistently reduce compiler drift:

- **`additionalProperties: false` everywhere** (object-level lockdown). This prevents prompt leakage into surprise fields and makes schema-drift detectable at parse time.
- **Prefer enums and bounded strings** for fields that otherwise balloon (e.g., `style_preset`, `camera_type`, `lighting_preset`).
- **Make “optional vs required” explicit**. In strict structured-output contexts, many teams make *most* top-level fields required and represent “unknown” via `null`/`"unspecified"` style sentinel values. (This avoids downstream nullability explosions during schema evolution and is easier to test.)

A practical “compiler IR” top-level shape that hardens well:

- `schema_version` (string, e.g., `"prompt_ir@2.1"`)
- `intent` (object: normalized intent)
- `image_analysis` (object: outputs from vision/OCR substeps)
- `prompt` (object: the final generation prompt text + negative constraints)
- `policy` (object: classification decisions, refusal/allow with reasons)
- `diagnostics` (object: non-user-visible telemetry hooks)

This “policy + diagnostics inside the IR” matters for two reasons:
1) A refusal can be represented as *data* (not free-form assistant text), keeping downstream runtime behavior deterministic.
2) You can compute refusal/fallback rates and schema-failure deltas straight from stored IR.

### Retry/repair strategy that doesn’t create regressions

OpenAI’s agent safety guidance notes that structured outputs and isolation reduce prompt injection risk but do not eliminate it. citeturn0search2  
That same logic applies to correctness: strict schemas reduce failure modes, but you still need deterministic recovery.

A production-grade retry/repair ladder for strict IR usually looks like:

**Parse → Validate → Repair → Escalate → Fail closed**

- **Parse**: attempt JSON parse.
- **Validate**: validate against JSON Schema before accepting the IR.
- **Repair pass (bounded)**:
  - Give the model the *invalid output* and the *schema*, and instruct: “Return ONLY a corrected object matching schema; preserve prior meaning; no new content.”
  - Cap at **1–2 repair attempts**; beyond that, treat as a hard failure to avoid infinite loops.
- **Escalate**:
  - If you use stage-splitting, escalate to a stronger model only after the fast repair path fails.
- **Fail closed**:
  - Emit a minimal IR with `policy.decision = "error"` and a stable error reason code contract (covered later).

This strategy aligns with OWASP’s advice to use separate calls for validation/summarization and to log decisions for auditability. citeturn1search6turn1search2

### Schema version migration without regressions

To migrate schemas safely, treat the schema itself like “production code”: canaried, test-gated, and rollbackable. Google’s SRE guidance explicitly frames canarying as relevant not only for binaries, but also for “configuration or data.” Your prompt templates and schemas are precisely that. citeturn2search3

A regression-resistant schema migration playbook:

- **Version every IR** (`schema_version`) and store the raw IR forever (or long enough to support repro).
- **Backwards-compatible changes first**:
  - Add new fields as optional + supply defaults downstream.
  - Extend enums only when downstream is tolerant.
- **Dual-read (and sometimes dual-write)**:
  - For a period, accept both old and new schema versions, normalize both into one canonical internal struct.
- **Translator layer**:
  - Implement `upgrade(v1 → v2)` and (optionally) `downgrade(v2 → v1)` transforms with unit tests.
- **Canary the schema**:
  - Route a small percent of traffic to “schema vNext,” compare key metrics (schema failure, refusal deltas, prompt fidelity deltas), and rollback on threshold breach. citeturn2search3turn2search27

## Multi-modal prompt-injection defense for image-derived text

The highest-risk multimodal failure mode in your system is: **text embedded in images hijacks the compiler** (via OCR, captioning, or the vision model’s own reading of text). This is no longer theoretical—recent research demonstrates “image-based prompt injection” where adversarial instructions are visually embedded and interpreted by multimodal LLMs as executable prompts. citeturn1search12turn1search0

### Threat model: image text is an untrusted instruction channel

Three converging sources reinforce the same operational point:

- OpenAI’s agent guidance defines prompt injection as untrusted input that attempts to override instructions; risk rises when arbitrary text influences tool calls or downstream actions. citeturn0search2
- Anthropic describes scanning untrusted content entering context windows and explicitly mentions injections embedded as “hidden text, manipulated images, deceptive UI elements.” citeturn1search1
- entity["organization","OWASP","security nonprofit"] emphasizes that LLMs process instructions and data together; therefore external content should be treated as untrusted and separated with boundaries/delimiters, with validation and logging. citeturn1search2turn1search6

### Best-practice pipeline: “quarantine OCR/caption output” before it reaches control logic

A hardened multimodal pipeline for your compiler typically looks like this:

**Step A: Vision extraction in a low-privilege lane**  
Run captioning/OCR in a step that can only output *data*, not directives. The step’s output should be an object like:

- `scene_facts` (dense description)
- `visible_text_blocks` (verbatim OCR text)
- `safety_flags` (e.g., “contains instruction-like text”, “contains URLs”, “contains request to reveal system prompt”)

**Step B: Treat extracted text as hostile**  
Never concatenate OCR text into:
- system prompts,
- tool specifications,
- the compiler’s instruction header.

Instead, embed it as quoted data under a “UNTRUSTED_CONTENT” key and require the compiler to ignore any “instructions” found there. This aligns with OWASP and OpenAI’s repeated recommendation to separate trusted instructions from untrusted content. citeturn1search6turn0search2turn1search3

**Step C: Source–sink controls at the orchestration layer**  
OpenAI’s recent prompt injection defense framing uses a “source/sink” model: attacks require a malicious source plus a dangerous sink (an action like exfiltration or tool execution). citeturn1search3turn0search9  
For a prompt compiler, your “sink” is: producing a final prompt that triggers disallowed content generation, or leaking hidden system/policy details into the prompt.

So you implement:
- allowlists for what the compiler is allowed to change,
- explicit denial of OCR-supplied instructions,
- “Safe URL / no exfil” rules if any external calls exist (generalizable sink-hardening). citeturn1search3

**Step D: Automated detection and adversarial testing**  
Two evidence points you can operationalize:

- OpenAI describes continuous hardening of an agent using automated red teaming and rapid-response loops when new injection patterns are discovered. citeturn1search33
- Security testing corpora now track “hidden image jailbreak” classes (including steganographic injection) as known multimodal vulnerabilities. citeturn1search21

Net effect: you don’t rely on “the model will ignore it.” You enforce “the system cannot be taken over.”

## Provider-policy envelope matrix with practical operational guidance

You asked for a *precise* “allowed vs refused” matrix, especially around fantasy violence boundaries. The most stable way to do this in production is a two-layer matrix:

- **Policy-layer envelope** (what providers say is prohibited/required).
- **Empirical enforcement layer** (what your integration actually observes per model version, per modality).

These layers often differ because vendors change enforcement and add model-side mitigations over time, and because different endpoints (text vs image/video) can be stricter than the universal policy language.

### Policy-layer envelope (what the providers explicitly restrict)

From the sources:

- OpenAI’s Usage Policies prohibit sexual violence and non-consensual intimate content, prohibit exposure of minors to age-inappropriate sexual/violent content, and prohibit “circumventing our safeguards.” citeturn7view0
- Anthropic’s Usage Policy explicitly prohibits generating sexually explicit content (including sex acts, fetishes/fantasies, erotic chats) and also prohibits content that promotes/trivializes/depicts “graphic violence or gratuitous gore.” citeturn5view0
- Google’s Generative AI Prohibited Use Policy prohibits engaging in sexually explicit or violent harmful activities and explicitly calls out circumvention of safety filters. citeturn2search2  
  Google’s Gemini app policy guidelines state Gemini should not generate pornography/erotic content or explicit/graphic sexual acts (with a note that context matters for educational/documentary/artistic/scientific applications). citeturn2search30

### Practical matrix: what you can plan for without getting surprised

The table below is **operational guidance** derived from policy text, not a promise of runtime behavior. The stability comes from two principles:
- If policy explicitly bans it, treat it as “refused or account-risky.”
- If policy language is silent, treat it as “test and monitor,” because enforcement can still be stricter at the product/endpoint level.

| Content class (your intended use) | OpenAI policy expectation | Anthropic policy expectation | Google policy expectation |
|---|---|---|---|
| Non-graphic fantasy violence (battle scenes, weapons present, no gore focus) | Policy focuses on threats/terrorism/violence and minors’ exposure; doesn’t explicitly ban fictional violence, but prohibits terrorism/hate-based violence and circumvention. Treat as “usually workable, test per endpoint.” citeturn7view0 | Policy forbids promoting/depicting *graphic violence or gratuitous gore*; non-graphic fantasy violence is not explicitly banned, but enforcement may still be cautious. Treat as “possible, but keep non-graphic.” citeturn5view0 | Prohibited use policy bans “sexually explicit, violent, hateful, or harmful activities”; Gemini guidance is context-driven. Treat as “possible for non-graphic fictional depictions; monitor refusals.” citeturn2search2turn2search30 |
| Graphic gore (dismemberment, entrails, torture focus) | OpenAI policies emphasize protecting people and minors; they ban sexual violence and non-consensual intimate content, and they prohibit circumvention. Because “graphic violence” is explicitly called out in minors rules and other vendor enforcement typically tightens around gore, treat as “high refusal risk; confirm per endpoint.” citeturn7view0 | Explicitly prohibited: “graphic violence or gratuitous gore.” Expect refusal. citeturn5view0 | “Violent… harmful activities” are prohibited at policy level; likely refusal for graphic gore. citeturn2search2turn2search30 |
| Nudity / erotic content intended for arousal | OpenAI policy bans sexual violence and non-consensual intimate content and requires protecting minors; it does not spell out a blanket ban on adult erotica in the universal policy text, so treat as “endpoint-dependent; high moderation needs; do not attempt safeguard circumvention.” citeturn7view0 | Explicitly prohibited: “Do Not Generate Sexually Explicit Content.” Expect refusal. citeturn5view0 | Gemini guidelines: pornography/erotic content should not be generated (context-sensitive exceptions). Expect refusal for “arousal” use cases. citeturn2search30 |
| Sexual violence / non-consensual intimate imagery | Prohibited. citeturn7view0 | Prohibited (also covered under psychologically/emotionally harmful content + sexual violence mention). citeturn5view0 | Prohibited by policy. citeturn2search2turn2search6 |
| Any sexual content involving minors (even fictional) | Prohibited; OpenAI states minors must never be sexualized and lists CSAM and grooming among prohibited uses, with reporting obligations. citeturn7view0 | Prohibited; defines minors under 18 and explicitly includes “fetishize or sexualize minors, including in fictional settings.” citeturn5view0 | Prohibited; policy and help-center guidance include CSAM/child exploitation prohibitions. citeturn2search6turn2search2 |

### How to make this stable in production

To make “allowed vs refused” operationally stable, you need an **empirical enforcement suite**:

- Maintain a vendor/model/version keyed matrix populated by nightly test runs.
- Record:
  - refusal rate by class,
  - false-refusal samples (manual review),
  - “policy mismatch” cases (policy suggests possible, model refuses).
- Alert on deltas, not absolutes (covered under canary thresholds).

This is consistent with canarying guidance: test changes on a small subset and compare against control to detect “ill effects.” citeturn2search3

## Latency and cost architecture experiments for compiler workloads

A prompt compiler has a favorable latency profile because the desired output is short and structured, but multi-stage pipelines can still become expensive if you overuse large models or fail to exploit caching.

### Stage splitting: fast validator + strong compiler

Separation into “fast validator” and “strong compiler” is supported by security guidance as well as performance logic:

- OWASP explicitly recommends separate LLM calls to validate/summarize untrusted content and emphasizes logging and audit trails. citeturn1search6turn1search2
- OpenAI’s agent safety docs emphasize isolation and structured outputs to reduce prompt injection risk. citeturn0search2

A measured experimentation plan for stage splitting:

- **Baseline**: one strong model call producing IR.
- **Split**:
  - Call 1 (fast): schema-only validation + “is this instruction injection?” heuristics on OCR/text
  - Call 2 (strong): compile final IR only if Call 1 passes
- Measure:
  - p50/p95 latency
  - cost per successful IR
  - schema-failure rate
  - false-refusal rate

### Prompt caching as a first-order performance lever

OpenAI documents that Prompt Caching can reduce latency **up to 80%** and input token cost **up to 90%**, and that it works automatically when prompts share a reusable prefix (common for stable system instructions and tool/schema definitions). citeturn0search1turn0search5

For compiler workloads, your highest-cache-hit prefixes are typically:
- system prompt + developer constraints
- schema/tool definitions
- canonical style presets

Design implications:
- Keep static instructions and schema definitions *stable* and *early* in the prompt so they are likely to land in the cached prefix. citeturn0search1
- Version prompts explicitly; avoid “small edits every deploy” unless you canary them (otherwise you’ll blow cache locality and silently regress latency).

### Priority vs async/batch lanes

OpenAI positions:
- **Priority processing** for “predictably low latency” and more consistent token generation speed versus standard processing. citeturn0search11
- **Flex processing** for lower costs in exchange for slower responses and occasional resource unavailability (ideal for evals, data enrichment, async workloads). citeturn0search8
- **Batch API** as part of cost optimization strategy, used for lowering cost and decoupling from interactive latency needs. citeturn0search22

A lane architecture that tends to work well for prompt compilers:

- **Interactive lane (user typing → immediate IR)**:
  - Small/fast models for validation and repair
  - Priority processing only for the “strong compiler” stage if it’s on the critical path
- **Offline lane (evals, corpus expansion, nightly policy-matrix tests, canary analysis)**:
  - Flex + Batch

This aligns with OpenAI’s own cost optimization guidance emphasizing reducing requests/tokens and choosing smaller models where possible, while using Batch/Flex for cheaper processing. citeturn0search22turn0search8

## Eval framework for prompt-compilers and adversarial corpus mining

You’re not evaluating “chat quality.” You’re evaluating a compiler. That changes what “good” means and makes CI gating much more realistic.

### Core scoring dimensions for prompt-compilers

A compiler-specific eval suite typically scores:

**Schema adherence**
- % outputs parseable and JSON-schema valid on first pass
- % requiring repair
- “unknown field” incidence (should be near zero with `additionalProperties: false`)

**Prompt fidelity**
- Does the final generation prompt preserve user intent and constraints?
- Does it avoid adding disallowed details?
- Are image-derived facts included only when relevant?

**Continuity retention**
- If you support multi-turn refinement: does the compiler maintain canonical constraints without drift?

**False-refusal and policy mismatch**
- When the user prompt is within the intended envelope, does the system refuse?
- Track false-refusal as *a metric*, not just anecdotes.

OpenAI’s Moderation endpoint supports checking text and images for harmful content categories and is positioned as a corrective-action tool (filtering, intervention). It’s also explicitly “free to use,” making it feasible to incorporate into eval and CI. citeturn6view0turn0search3

### CI gates: making failures non-ambiguous

The simplest CI architecture is:

- Run a fixed evaluation corpus on every prompt/schema change.
- Fail the build if:
  - schema failure rate increases above threshold,
  - refusal rate increases above threshold for “allowed” test sets,
  - injection detector miss rate increases.

This is strongly aligned with the “continuous hardening via automated red teaming and rapid response loop” model OpenAI describes for an agent system. citeturn1search33

### Real-world adversarial corpus design and continuous mining

To keep the corpus fresh, mine your own production traces into test cases:

- **Capture** every stage output (vision facts, OCR text, validator decision, compiler IR, refusal reasons).
- **Cluster** by:
  - high similarity + different outcomes (great for spotting nondeterminism)
  - refusals that users appealed
  - high repair frequency
- **Promote** samples into the corpus when:
  - a human marks it as “false refusal”
  - it triggers a schema repair
  - it contains injection signatures (URLs, “ignore previous instructions,” hidden text indicators)

This is consistent with:
- OpenAI’s explicit framing that prompt injection is a persistent industry challenge and needs layered defenses rather than a one-time fix. citeturn1search18turn1search3
- Research showing image-based prompt injection can rapidly manipulate multimodal outputs (so your adversarial corpus must include image-text cases, not only text jailbreaks). citeturn1search12turn1search0

A practical way to bootstrap multimodal adversarial cases is to include known vulnerability classes tracked by toolkits like entity["organization","Promptfoo","llm testing toolkit"] (e.g., “hidden image jailbreak” style cases) and expand with your own failures. citeturn1search21

## Canonical-state continuity, refusal taxonomy, and rollout governance

This section ties together the operational topics: preventing state pollution, standardizing refusal reasons, enforcing control-plane precedence, and running safe canaries/rollbacks.

### Canonical-state continuity patterns that prevent drift and pollution

A robust prompt compiler usually follows a “transactional IR” approach:

- **Draft IR** is produced per request.
- **Commit IR** occurs only if:
  - schema validation passes,
  - policy checks pass,
  - any repair attempts succeed within bounds.

If a request fails (provider outage, refusal, schema failure), do *not* write partial state into the canonical session memory. Instead log it as an event and keep the last known-good IR as the session’s canonical state.

This strategy directly addresses “fallback/error turns polluting canonical prompt memory across sessions and mode switches.”

### Refusal/fallback taxonomy standard: a single reason_code contract

To keep infra fallback, safety refusal, and upstream hard errors distinguishable, define a **reason_code vocabulary** inside your IR, not in ad hoc logs.

A practical contract shape:

- `decision`: `"allow" | "refuse" | "error"`
- `reason_code` (enum) examples:
  - `POLICY_PROVIDER_SEXUAL_CONTENT`
  - `POLICY_PROVIDER_GRAPHIC_VIOLENCE`
  - `POLICY_MINORS`
  - `SECURITY_PROMPT_INJECTION_SUSPECTED`
  - `SCHEMA_INVALID`
  - `UPSTREAM_TIMEOUT`
  - `UPSTREAM_RATE_LIMIT`
  - `UPSTREAM_5XX`
- `retryable`: boolean
- `user_message_safe`: short string that can be shown without leaking internal details

Why this matters:
- It supports canary gating on “false refusal delta” vs “upstream failure delta.”
- It prevents “everything looks like a refusal,” which destroys routing and rollback decisions.

This aligns with OWASP’s call for logging agent decisions/tool calls/outcomes and maintaining audit trails. citeturn1search6

### Control-plane precedence proof tests and cache invalidation

You want to ensure an “invisible control plane” (profiles, presets, bans, allowances) cannot silently drift.

Two research-backed operational principles:

- Canarying should apply to **configuration and data changes**, not only code. Google’s canary guidance explicitly includes configuration/data in the change set. citeturn2search3
- Error budgeting and SLO-based alerting provide a framework for deciding when to slow/stop releases and prioritize stability. citeturn2search27turn2search19

A control-plane precedence test strategy:

- Define an explicit order: `environment defaults` < `org policy` < `user profile` < `request overrides` < `emergency killswitch`.
- For each precedence edge, create deterministic tests:
  - same request, different profile → expected IR diff
  - same profile, different environment → expected IR diff
- Add a **cache key discipline**:
  - if prompts are cached, the cache key must incorporate prompt-template version + schema version + control-plane version hash (otherwise cached prefixes can mask drift).

### Canary + rollback thresholds that map to compiler metrics

Google’s canarying guidance emphasizes comparing canary vs control and monitoring for increased errors/latency/load before full rollout. citeturn2search3turn2search11  
For prompt compilers, define “stop rollout” thresholds on *compiler-native* metrics:

- **Schema-failure delta**: rollback if schema-valid rate drops beyond threshold.
- **Fallback-rate delta**: rollback if `UPSTREAM_*` increases beyond threshold.
- **False-refusal delta**: rollback if refusal rate increases on the “allowed” eval set.
- **Repair-rate delta**: rollback if repair attempts spike (often a signal of prompt-template regression).

Tie these to SLO/error-budget policy so you have a principled, organization-wide release gate rather than subjective “it seems worse.” citeturn2search27

### Prompt-template governance: auditability + test-gated changes

Prompt templates, schemas, and policy rules should be governed like code:

- Versioned artifacts
- Code review required
- CI eval suite required
- Canary required for high-impact changes (especially those that affect cached prefixes)

This is reinforced by the combination of:
- OpenAI’s emphasis that circumventing safeguards can lead to penalties and that enforcement is monitored. citeturn7view0
- The security reality that prompt injection is persistent and requires defense-in-depth, including isolation and continuous testing. citeturn1search18turn0search2turn1search33