# ShortPulse AI Studio Overview

## One-Sentence Definition
ShortPulse AI Studio is an AI-powered creative canvas where creators generate, iterate, and store images and videos — turning performance insight into repeatable visual output.

Route: `/ai-studio` (dashboard tile: AI Studio).

## Purpose
- Bridge performance intelligence to creative execution: turn insight into output, patterns into assets, prompts into reusable systems.
- Provide a production environment for repeatable, data-informed content creation, not a novelty generator.

## Mental Model
- Canvas and workspace for thinking and iteration, not a form or one-click generator.
- Creative control room: intentional, versioned, reusable assets saved to the Media Library.
- Transparent and interactive: no modal-heavy UX or black-box generation flows.

## Canvas Experience
- Write/refine prompts, pick AI models, set generation parameters, and preview outputs in one place.
- Rapid iteration and version comparison to make creative decisions quickly.
- Outputs are saved, taggable, and ready for downstream use; nothing is temporary.

## Supported Creation Types (v1)
- **Image Generation:** Multiple image models, adjustable aspect ratios (1:1, 9:16, 16:9), prompt iteration, version comparison, save + tag + reuse in SlideFlow.
- **Video Generation:** Multiple video models with aspect control for short-form formats, prompt-based creation, direct save to Media Library as first-class assets.

## Model Access & Selection
- Choose among multiple generation models and switch without leaving the canvas.
- Compare outputs across models to test style, match platforms, and build consistent visual identities.

## Aspect Ratio Control
- Ratios are explicit, not an afterthought: 9:16, 1:1, 16:9, 4:5, 5:4, 2:3, 3:2.
- Ensures platform-native, immediately usable assets without later cropping.

## Prompt Management
- Prompts are creative assets: save, reuse, refine, and store alongside generated media with metadata.
- Reapply prompts to new models and use them as starting points to build prompt systems over time.

## Media Library Integration
- All generated images/videos and their prompts/metadata flow into the Media Library for archival, reuse, and handoff to other tools.
- Media Library remains the source of truth for iterations and asset organization.

## Relationship to SlideFlow Studio
- AI Studio is the generation layer; SlideFlow Studio is the assembly/publishing layer.
- Workflow: generate in AI Studio → save to Media Library → assemble/publish in SlideFlow Studio.

## What AI Studio Is Not
- Not a single-prompt toy, novelty AI generator, or wrapper around one model.
- Not a disconnected experiment; built for real creative throughput and repeatable systems.

## Who It Is For
- Growth-stage creators and content-first entrepreneurs who need control, consistency, and speed without chaos.

## Long-Term Role
- Becomes the execution arm of ShortPulse intelligence: a pattern-to-output engine and core pillar of the end-to-end content system.

## Current UI Snapshot (Jan 2027)
- Photoshop-style canvas: left fixed rail (logo, back-to-dashboard, Create/Edit/Organize) anchors the layout; hero stats for AI credits and plan sit above the workspace.
- Create card: three-step flow (Select mode / Frame & model / Write your prompt) with Enhance, Image, Video toggles; fixed aspect/model selects; Save prompt + Media library quick actions; refreshed prompt textarea with slim scrollbar.
- Reference Canvas: transparent container with a scrollable five-column grid of 4:5 cards. Generates dummy previews for image/video and text cards for prompt mode; cards are draggable (image cards carry an image URL, text cards carry prompt text).
- Reference details modal: double-click a reference card to open a modal with the media preview and metadata; prompt references open a simplified prompt-first view with a scrollable prompt body and a Save to Media Library CTA (UI only for now).
- Studio Preview: two drop zones (Image Reference and Prompt). Dropped image/text hides the outline/content and shows the payload; reference drop supports dragged images, prompt drop supports dragged text. Media/library buttons sit in the header.
- Image Regen uses a two-step **Recreate** flow: carded steps with numbered badges (Drop Image at 4:5, Drop prompt) plus persistent Save/Regenerate actions; first generated assets auto-seed empty drop zones, and external image files can be dragged into the Reference Canvas.
