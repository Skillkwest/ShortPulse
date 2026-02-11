# Short Flow Outlier Score: Source of Truth

## 1. Purpose of This Document
This document defines exactly how **Short Flow** calculates outliers across **YouTube, Instagram, and TikTok**, using a unified, creator‑relative performance model. This is the authoritative reference for engineering, data, design, and AI agents.

Short Flow’s outlier system answers a simple question:

**“How many times better is this video performing compared to this creator’s normal performance?”**

The entire system revolves around that principle.

---

## 2. Why Creator‑Relative Outliers?
All three platforms reward videos that outperform a creator’s historical norms. While platforms differ in how they distribute content, they **all internally model deviation from expected performance**.

Using a creator-relative model ensures:
- Fair comparison across creators of all sizes
- No penalty for small creators with low baselines
- No unfair advantage for large creators with huge historical averages
- A stable, interpretable performance measurement

This matches real platform behavior: videos that spike far above a creator’s typical range are the ones platforms push.

---

## 3. Core Outlier Formula
The outlier system is intentionally simple and interpretable.

### **Step 1 — Establish the Creator Baseline**
For each video *v* belonging to creator *C*:
```
creator_avg_excluding_v = mean(views of all other videos by creator C)
```
This prevents the current video from inflating its own baseline.

### **Step 2 — Compare the Video to That Baseline**
```
outlier_score = views_of_v / creator_avg_excluding_v
```
This produces a **times‑above‑average multiplier**.

Example:
- Creator average = 10,000 views
- Video gets 50,000 views
- Outlier score = **5×**

### **Step 3 — Classify the Outlier Strength**
Humans understand multipliers intuitively. The system outputs labels based on magnitude.

| Outlier Score | Meaning | Classification |
|---------------|---------|----------------|
| **0.5× – 1.5×** | Within expected performance | Typical |
| **2× – 5×** | Noticeable above average | Strong |
| **5× – 10×** | Clear breakout | High Outlier |
| **10× – 20×** | Rare, strong acceleration | Major Outlier |
| **20× – 50×** | Extremely rare | Breakout |
| **50× – 100×+** | Massive deviation | Viral Outlier |
| **100×+** | Platform anomaly | Explosive |

This scale is universal across YouTube, Instagram, and TikTok.

---

## 4. Unified Outlier Logic Across All Platforms
Although platforms differ algorithmically, Short Flow uses a **single universal outlier model**:

> **A video is an outlier if it earns a multiple of the creator’s normal performance.**

This applies identically to:
- YouTube Videos
- TikToks
- Instagram Reels
- YouTube Shorts

Because the formula is creator-relative, it works regardless of:
- Vertical
- Audience size
- Upload frequency
- Content type

This ensures Short Flow is consistent and defensible.

---

## 5. Platform‑Specific Notes

### **YouTube**
YouTube already uses creator-relative analytics internally. Short Flow follows the same logic.

Key signal: **How this video performs compared to the creator’s last 10 videos.**

Short Flow generalizes this to **all historical videos**, excluding the current one.

### **Instagram Reels**
Even though Instagram’s feed ranking is global, creator history still impacts expected performance.

Short Flow identifies the *relative deviation* from the creator’s baseline to determine true outlier status.

### **TikTok**
TikTok is the most global and interest‑based platform, but creator-relative spikes still signal that a video is performing unusually well for that creator.

Short Flow uses the same multiplier formula.

---

## 6. Mathematical Examples

### Example 1 — Mild Outlier
- Creator average: 8,000 views
- Video views: 20,000
- Score: 20,000 / 8,000 = **2.5×** → **Strong**

### Example 2 — Major Breakout
- Creator average: 12,000 views
- Video views: 240,000
- Score: 240,000 / 12,000 = **20×** → **Major Outlier**

### Example 3 — Viral Outlier
- Creator average: 5,000 views
- Video views: 750,000
- Score: 750,000 / 5,000 = **150×** → **Viral/Explosive**

---

## 7. Data Requirements
To compute the outlier score, Short Flow must have:
- All videos associated with the creator
- Views for each video
- Timestamp (optional, but useful for windows)
- Deduped canonical IDs

If a creator has only one video, outlier calculation is deferred until a second video exists.

---

## 8. Integration With UI
Outlier scores directly drive visual signals in Short Flow.

### Scatter Plot Highlighting
Outlier videos are displayed using **Momentum Amber**, drawing attention to exceptional performance.

### Ranking Cards
Outlier scores appear as multipliers:
- "5.2× Above Normal"
- "18× Breakout"

### Recommendation Surfaces
Videos with high outlier scores surface to the top of discovery and ranking lists.

---

## 9. Why Multipliers Instead of Percentiles?
Percentiles show how a video compares to the *platform*.
Multipliers show how a video compares to *the creator*.

Creators care about their own norms.
Platforms reward deviation from those norms.

Multipliers are:
- Intuitive
- Comparable across creators
- Aligned with actual algorithmic behavior

---

## 10. Summary
Short Flow’s Outlier Score is defined by three principles:

1. **Creator‑relative performance** is the only fair cross‑platform metric.
2. **Outliers are measured as multiples above the creator’s baseline.**
3. **Multipliers produce meaningful, intuitive categories** like 5×, 10×, 20×, 50×.

This document is the single source of truth for all engineering, design, and analytical decisions involving outlier detection in Short Flow.

---

End of document.

