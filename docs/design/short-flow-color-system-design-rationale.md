# Short Flow Color System – Design Rationale

This document explains **why** the Short Flow color palette exists, **how** each color should be used, and **what** design problems it solves across the product. It is a practical reference for design, engineering, and data visualization.

---

## 1. Color System Overview

Short Flow is a **data‑driven, momentum‑focused analytics app** for short‑form video. The interface must:

- Communicate **credibility and clarity** (analytics, not hype)
- Highlight **signal and momentum** without visual noise
- Support **dense scatter plots and charts** without fatigue
- Feel modern and creator‑friendly, but not cartoonish

To achieve this, the color system is built around a **dark, low‑noise foundation** with a **single strong accent** and a **high‑impact highlight** for breakout performance.

### Palette Summary

- **Background (Primary):** `#0F1115` – Deep Graphite
- **Panels (Secondary):** `#1C1F26` – Slate Gray
- **Accent / Signal:** `#25A9BF` – Signal Teal
- **Momentum Highlight:** `#F5B942` – Momentum Amber
- **Text / Neutral UI:** `#C9CDD6` – Soft Ash

The rest of this document defines how these colors work together throughout the product.

---

## 2. Background & Panels

### 2.1 Primary Background – Deep Graphite `#0F1115`

**Role:** Global app background and chart canvas base.

**Why this color:**
- A very dark, slightly warm gray that avoids harsh pure black.
- Provides maximum contrast for bright data points without eye strain.
- Creates a sense of focus and seriousness appropriate for analytics.

**Usage guidelines:**
- Use as the background for:
  - Root app container
  - Main pages
  - Fullscreen charts
- Avoid placing long paragraphs of bright white text directly on this color. Use Soft Ash (`#C9CDD6`) for body text to reduce glare.

### 2.2 Secondary Background – Slate Gray `#1C1F26`

**Role:** Structural surfaces and containment.

**Why this color:**
- Slightly lighter than Deep Graphite, creating **depth and separation** without using borders everywhere.
- Keeps components visually distinct without distracting from the data.

**Usage guidelines:**
- Use for:
  - Cards and panels
  - Navigation bars and sidebars
  - Chart containers, filters, and toolbars
- Panels should sit on top of the primary background to create a subtle layered effect.
- Avoid using this color for primary buttons; it is a neutral structural color, not an action color.

---

## 3. Accent / Signal – Signal Teal `#25A9BF`

**Role:** Primary accent color representing **signal, flow, and active state**.

**Why this color:**
- Teal visually communicates **data, clarity, and motion**—ideal for an app about content “flow.”
- It contrasts sharply with dark backgrounds while remaining easy on the eyes.
- It feels modern and tech‑forward without being cold or overly corporate.

**Usage guidelines:**
- Use for:
  - Primary buttons (e.g., "Run Analysis", "Refresh Data")
  - Active navigation items and selected states
  - Key data points or series in charts by default
  - Links, toggles, and interactive elements that require user attention
- Avoid overuse: not every chart series or card should be teal. It should still feel special and meaningful.

**Accessibility considerations:**
- On Deep Graphite and Slate Gray backgrounds, Signal Teal meets contrast requirements for core UI elements.
- When used over Soft Ash (light backgrounds, rare), ensure font weights and sizes are sufficient for readability.

---

## 4. Momentum Highlight – Momentum Amber `#F5B942`

**Role:** High‑impact highlight color for **top‑performing or exceptional content**.

**Why this color:**
- Warm yellow‑amber is instantly read as **energy, momentum, and importance**.
- It visually stands out from both the teal accent and the neutral background.
- It is ideal for communicating “this point is special” in a dense field of data.

**Usage guidelines:**
- Use sparingly for:
  - Outlier or top‑percentile data points (e.g., 95th+ percentile performance)
  - Highlighted clusters or breakout Reels
  - Important annotations or thresholds on charts
  - Badges or tags indicating “Breakout,” “Top 1%,” or similar labels
- Do **not** use Momentum Amber as a general accent or button color. Its meaning should remain strongly associated with **exceptional performance**.

**Interaction with other colors:**
- Works best when most other chart points use more muted tones or teal; the amber points should visually “pop” immediately.
- Avoid using red for similar purposes in this system; amber is the primary performance signal.

---

## 5. Text & Neutral UI – Soft Ash `#C9CDD6`

**Role:** Primary text and neutral UI elements.

**Why this color:**
- A light, slightly cool neutral that is readable on dark backgrounds without the harshness of pure white.
- Maintains a calm reading experience for dense analytical content.

**Usage guidelines:**
- Use for:
  - Body text
  - Axis labels, tick labels, and chart legends
  - Secondary icons and outlines
  - Neutral controls (e.g., unselected tabs, labels, form inputs)
- Reserve pure white (`#FFFFFF`) only for very small, high‑priority elements (e.g., text inside primary buttons) where maximum contrast is needed.

**Hierarchy control:**
- For secondary text, reduce opacity (e.g., 70–80%) instead of introducing new colors. This preserves palette simplicity.

---

## 6. Chart & Data Visualization Guidelines

The core visualization in Short Flow is a **scatter plot** of videos:
- X‑axis: views‑per‑hour percentile
- Y‑axis: engagement‑rate percentile
- Dot size: views

The color system should enhance readability and pattern recognition.

### 6.1 Default Data Points

- Base point color: a desaturated version of Soft Ash or a muted teal (e.g., Signal Teal at lower opacity).
- Purpose: keep most points visible but not overwhelming.

### 6.2 Highlighted / Top‑Performing Points

- Use **Momentum Amber (`#F5B942`)** for top‑percentile points.
- Optional: slightly larger point size or subtle glow to reinforce importance.

### 6.3 Selected / Hovered Points

- Use **Signal Teal (`#25A9BF`)** outline or halo around the selected point.
- Tooltip background: Slate Gray with Soft Ash text for readability.

### 6.4 Axes & Gridlines

- Axes lines: Soft Ash at low opacity (e.g., 25–40%).
- Gridlines: even lighter / more transparent than axes.
- Aim: support orientation without competing with data points.

---

## 7. UI Layout & States

### 7.1 Navigation

- Background: Slate Gray
- Inactive links: Soft Ash at medium opacity
- Active/hovered links: Signal Teal text or underline

### 7.2 Buttons

- **Primary button**
  - Background: Signal Teal
  - Text: White
  - Hover: slightly brighter teal or subtle glow

- **Secondary button**
  - Background: Slate Gray
  - Border: Signal Teal or Soft Ash
  - Text: Soft Ash

- **Destructive actions**
  - Use variations of gray with clear text labels (e.g., “Delete”).
  - Avoid introducing red in v1 unless absolutely necessary for clarity.

### 7.3 Cards & Panels

- Card background: Slate Gray
- Card title: Soft Ash (full opacity)
- Card subtitle / metadata: Soft Ash at reduced opacity
- Primary metric or value in card: Signal Teal

---

## 8. Thematic Rationale

The palette is intentionally **minimal and disciplined**. It tells a specific story:

- The dark foundation (`#0F1115` / `#1C1F26`) frames Short Flow as a **serious analytics tool** rather than a social app.
- Signal Teal (`#25A9BF`) represents **information flow and meaningful signal** emerging from noise.
- Momentum Amber (`#F5B942`) marks **breakout performance**—the moments Short Flow exists to reveal.
- Soft Ash (`#C9CDD6`) keeps text and controls readable without competing with the data.

Together, these colors:
- Emphasize **signal over decoration**
- Support long analytical sessions without fatigue
- Give the app a distinctive, ownable visual identity

---

## 9. Extension & Future‑Proofing

For v1, this palette is intentionally tight. Future extensions may include:

- A small set of **secondary accent colors** for representing multiple platforms (e.g., TikTok, YouTube) in the same view.
- Light mode variants, if needed for specific use cases or embeds.

Any additions must:
- Preserve the central roles of Signal Teal and Momentum Amber
- Maintain a restrained, data‑first aesthetic

---

### Summary

This color system is not just visual decoration; it encodes meaning:
- **Background & panels** establish a calm analytical environment.
- **Signal Teal** marks interaction, clarity, and active data.
- **Momentum Amber** marks exceptional outcomes and top performers.
- **Soft Ash** ensures legible, low‑noise communication.

Short Flow’s color palette is designed to make **important patterns in short‑form video performance obvious at a glance**—and to stay out of the way everywhere else.

