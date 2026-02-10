# ShortPulse Design System Guide

**Version:** 1.0
**Last Updated:** February 2026
**Status:** ✅ Production Ready

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Design Tokens](#design-tokens)
3. [Component System](#component-system)
4. [Accessibility](#accessibility)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)
7. [Migration Guide](#migration-guide)

---

## Philosophy

ShortPulse's design system is built on the principles established by our AI Studio interface, which represents the gold standard for visual design, accessibility, and user experience across the application.

### Core Principles

1. **Systematic over ad-hoc** - Use design tokens, never hardcode values
2. **Content-first** - Minimize UI chrome, let content breathe
3. **Progressive disclosure** - Show advanced options only when needed
4. **Accessibility as default** - Focus states, ARIA, reduced motion built-in
5. **Performance-conscious** - Solid colors over gradients, lighter shadows
6. **Modular architecture** - Small focused CSS files, namespaced classes
7. **Color discipline** - Limit opacity levels, reserve gradients for CTAs
8. **Subtle interactions** - -2px hover standard, cubic-bezier easing

### Design Reference

AI Studio serves as the reference implementation. When in doubt about design decisions, refer to AI Studio's patterns in `/frontend/styles/ai-studio-*.css`.

---

## Design Tokens

Design tokens are the atomic design decisions that form the foundation of the design system. They ensure consistency and make global changes easy.

### Spacing Scale

**File:** `frontend/styles/design-tokens.css`

Use **ONLY** these spacing values throughout the application:

```css
--spacing-4: 4px;    /* Tight gaps, icon padding */
--spacing-6: 6px;    /* Minimal spacing */
--spacing-8: 8px;    /* Small gaps, compact layouts */
--spacing-10: 10px;  /* Standard small spacing */
--spacing-12: 12px;  /* Common gap size */
--spacing-14: 14px;  /* Medium gaps */
--spacing-16: 16px;  /* Standard gap (AI Studio --ai-gutter) */
--spacing-18: 18px;  /* Large gaps */
--spacing-20: 20px;  /* Section spacing */
--spacing-24: 24px;  /* Page padding, hero spacing */
```

**Usage:**
```css
/* ✅ GOOD */
padding: var(--spacing-12) var(--spacing-16);
gap: var(--spacing-10);

/* ❌ BAD */
padding: 13px 17px;
gap: 11px;
```

### Border Radius System

Systematic scale for consistent roundness:

```css
--radius-xs: 6px;     /* Toolbar items, small elements */
--radius-sm: 8px;     /* Small buttons, inputs */
--radius-md: 10px;    /* Default elements */
--radius-lg: 12px;    /* Cards, panels */
--radius-xl: 14px;    /* Large cards */
--radius-2xl: 20px;   /* Hero cards, large panels */
--radius-3xl: 24px;   /* Primary buttons, hero sections */
--radius-full: 999px; /* Pills, toggles, circular elements */
```

**Usage Examples:**
- Small buttons: `border-radius: var(--radius-sm);`
- Standard cards: `border-radius: var(--radius-xl);`
- Hero sections: `border-radius: var(--radius-3xl);`
- Profile avatars: `border-radius: var(--radius-full);`

### Typography Scale

Five distinct levels for hierarchy:

```css
--text-display: 32px;  /* Page titles, hero headings (h1) */
--text-lg: 18px;       /* Large text, subheadings (h3) */
--text-base: 14px;     /* Body text, standard UI */
--text-sm: 13px;       /* Small text, secondary labels */
--text-xs: 12px;       /* Extra small text, metadata */
--text-2xs: 11px;      /* Micro text, hints */
--text-3xs: 10px;      /* Smallest text, status badges */
```

### Font Weights

```css
--font-normal: 400;    /* Body text */
--font-medium: 500;    /* Emphasis */
--font-semibold: 600;  /* Subheadings */
--font-bold: 700;      /* Headings, buttons */
--font-extrabold: 800; /* Hero text */
```

### Letter Spacing

```css
--tracking-tight: -0.01em;   /* Large headings */
--tracking-normal: 0;        /* Body text */
--tracking-wide: 0.01em;     /* Labels */
--tracking-wider: 0.02em;    /* Buttons */
--tracking-widest: 0.08em;   /* Uppercase labels */
--tracking-button: 0.3px;    /* Primary button text */
```

### Shadow System

Elevation hierarchy through shadows:

```css
--shadow-flat: none;                           /* No elevation */
--shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.25);  /* Subtle lift */
--shadow-md: 0 12px 32px rgba(0, 0, 0, 0.32); /* Standard cards */
--shadow-lg: 0 20px 50px rgba(0, 0, 0, 0.4);  /* Elevated cards */
--shadow-xl: 0 30px 80px rgba(0, 0, 0, 0.5);  /* Hero sections */

/* Multi-layer shadow for gradient buttons (AI Studio pattern) */
--shadow-teal-glow:
  0 8px 20px rgba(30, 64, 175, 0.3),
  0 4px 12px rgba(6, 182, 212, 0.35),
  0 0 0 1px rgba(34, 211, 238, 0.2);
```

### Transitions

Cubic-bezier easing for sophisticated motion:

```css
--transition-fast: 0.12s cubic-bezier(0.4, 0, 0.2, 1);  /* Quick feedback */
--transition-base: 0.2s cubic-bezier(0.4, 0, 0.2, 1);   /* Standard */
--transition-slow: 0.3s cubic-bezier(0.4, 0, 0.2, 1);   /* Dramatic */
```

### Color Palette

**File:** `frontend/styles/foundation.css`

```css
/* Base Colors */
--color-bg: #0f1115;              /* Dark navy background */
--color-panel: #1c1f20;           /* Panel backgrounds */
--color-teal: #25a9bf;            /* Primary accent (cyan/teal) */
--color-amber: #f5b942;           /* Secondary accent (warm orange/gold) */

/* Text Colors */
--color-ash: #c9cdd6;             /* Primary text (AAA contrast) */
--color-ash-70: rgba(201, 205, 214, 0.9);  /* Secondary text */
--color-ash-50: rgba(201, 205, 214, 0.5);  /* Tertiary text (improved contrast) */
--color-ash-40: rgba(201, 205, 214, 0.4);  /* Disabled text */
--color-ash-30: rgba(201, 205, 214, 0.3);  /* Subtle borders */
```

**Color Theory Application:**

- **60-30-10 Rule:** 60% dark background, 30% mid-tone panels, 10% accent colors
- **Temperature Balance:** 65% cool, 30% neutral, 5% warm (AI Studio pattern)
- **Opacity Discipline:** Limit to 2-3 opacity levels per context
- **Gradient Reserve:** Use gradients only for primary CTAs

**WCAG Contrast Ratios:**

| Element Type | Color | Contrast Ratio | Compliance |
|--------------|-------|----------------|------------|
| Primary Text | `--color-ash` | 12.8:1 | AAA |
| Secondary Text | `--color-ash-70` | 10:1 | AAA |
| Tertiary Text | `--color-ash-50` | 4.9:1 | AA |
| Interactive | `--color-teal` | 4.5:1+ | AA |

---

## Component System

Pre-built, reusable component classes ensure visual consistency across all pages.

### Buttons

**File:** `frontend/styles/components-buttons.css`

#### Primary Button

Gradient CTA for main actions:

```html
<button class="btn-primary">
  Save Changes
</button>
```

**CSS:**
```css
.btn-primary {
  background: linear-gradient(135deg, #2563eb 0%, #06b6d4 50%, #22d3ee 100%);
  color: #ffffff;
  padding: var(--spacing-12) var(--spacing-16);
  border-radius: var(--radius-lg);
  font-weight: var(--font-bold);
  letter-spacing: var(--tracking-wider);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 20px rgba(30, 64, 175, 0.3),
    0 4px 12px rgba(6, 182, 212, 0.35);
}
```

#### Secondary Button

Ghost style for secondary actions:

```html
<button class="btn-secondary">
  Cancel
</button>
```

#### Danger Button

Red tint for destructive actions:

```html
<button class="btn-danger">
  Delete Account
</button>
```

#### Amber Button

Upgrade/premium CTAs:

```html
<button class="btn-amber">
  Upgrade to Pro
</button>
```

#### Button Sizes

```html
<button class="btn-primary btn-sm">Small</button>
<button class="btn-primary btn-md">Medium</button>
<button class="btn-primary btn-lg">Large</button>
```

#### Button Variants

```html
<button class="btn-primary btn-full-width">Full Width</button>
<button class="btn-secondary btn-icon-only">
  <svg>...</svg>
</button>
```

### Cards

**File:** `frontend/styles/components-cards.css`

#### Base Card

Standard card with hover effect:

```html
<a href="/link" class="card">
  <div class="card-header">
    <div class="card-icon card-icon-teal">
      <svg>...</svg>
    </div>
    <h3 class="card-title">Card Title</h3>
  </div>
  <div class="card-body">
    <p class="card-description">Card description here...</p>
  </div>
  <div class="card-footer">
    <span class="card-meta">Metadata</span>
  </div>
</a>
```

#### Card Variants

```css
.card-elevated    /* Higher shadow */
.card-flat        /* No shadow */
.card-interactive /* More emphasis on hover */
.card-hero        /* Larger border radius */
```

#### Card Sizes

```css
.card-sm  /* padding: 12px, radius: 12px */
.card-md  /* padding: 16px, radius: 14px */
.card-lg  /* padding: 20px, radius: 20px */
```

#### Card Color Accents

```css
.card-teal    /* Teal border accent */
.card-amber   /* Amber border accent */
.card-success /* Success state (green tint) */
.card-error   /* Error state (red tint) */
```

#### Card Grid Layouts

```html
<!-- Standard grid (Dashboard pattern) -->
<div class="card-grid">
  <div class="card">...</div>
  <div class="card">...</div>
</div>

<!-- Compact grid -->
<div class="card-grid-compact">
  <div class="card">...</div>
</div>

<!-- Wide grid (for media) -->
<div class="card-grid-wide">
  <div class="card">...</div>
</div>
```

### Inputs

**File:** `frontend/styles/components-inputs.css`

#### Text Input

```html
<div class="form-group">
  <label class="label label-required">Email Address</label>
  <input type="email" class="input" placeholder="you@example.com" />
  <p class="helper-text">We'll never share your email</p>
</div>
```

#### Input States

```css
.input           /* Default state */
.input-error     /* Error state (red border) */
.input-success   /* Success state (green border) */
.input:disabled  /* Disabled state */
```

#### Input Sizes

```css
.input-sm  /* Small input */
.input     /* Default */
.input-lg  /* Large input */
```

#### Textarea

```html
<textarea class="input" rows="4" placeholder="Enter text..."></textarea>
```

#### Select Dropdown

```html
<select class="select">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

#### Input Group

Input with prefix/suffix:

```html
<div class="input-group">
  <span class="input-prefix">@</span>
  <input type="text" placeholder="username" />
</div>
```

#### Search Input

```html
<div class="search-input">
  <svg><!-- Search icon --></svg>
  <input type="search" placeholder="Search..." />
</div>
```

#### Checkbox & Radio

```html
<input type="checkbox" class="checkbox" id="agree" />
<label for="agree">I agree</label>

<input type="radio" class="radio" name="option" id="opt1" />
<label for="opt1">Option 1</label>
```

---

## Accessibility

**File:** `frontend/styles/accessibility.css`

ShortPulse prioritizes accessibility to ensure all users can navigate and use the application effectively.

### Focus-Visible States

All interactive elements automatically receive cyan focus outlines when navigated with keyboard:

```css
/* Global focus-visible */
*:focus-visible {
  outline: 2px solid #22d3ee;
  outline-offset: 2px;
}

/* Button focus */
button:focus-visible,
.btn-primary:focus-visible {
  outline: 2px solid #22d3ee;
  outline-offset: 3px;
}

/* Input focus */
input:focus-visible,
select:focus-visible {
  outline: 2px solid rgba(37, 169, 191, 0.5);
  outline-offset: 2px;
}
```

**Testing:**
- Reload any page
- Press `Tab` key repeatedly
- You should see cyan outlines on all interactive elements

### Skip Links

Every page should include a skip link for keyboard users:

```html
<a href="#main-content" class="skip-link">
  Skip to main content
</a>

<main id="main-content">
  <!-- Page content -->
</main>
```

**Behavior:**
- Hidden by default (positioned off-screen)
- Visible when focused (slides down from top)
- Allows users to bypass navigation and jump to main content

### Screen Reader Support

#### Screen Reader Only Text

Content visible only to screen readers:

```html
<span class="sr-only">This text is only for screen readers</span>
```

#### ARIA Live Regions

Dynamic content announcements:

```html
<!-- Polite announcements (non-urgent) -->
<div role="status" aria-live="polite">
  File uploaded successfully
</div>

<!-- Assertive announcements (urgent, like errors) -->
<div role="alert" aria-live="assertive">
  Error: File upload failed
</div>
```

#### Semantic HTML

Use semantic elements for better screen reader navigation:

```html
<!-- ✅ GOOD -->
<section aria-labelledby="tools-heading">
  <h2 id="tools-heading">Tools</h2>
  <div>...</div>
</section>

<article role="article" aria-label="Media Library: Video tool">
  <h3>Video Library</h3>
  <p>Manage your videos</p>
</article>

<!-- ❌ BAD -->
<div>
  <p class="eyebrow">Tools</p>
  <div>...</div>
</div>
```

### Reduced Motion Support

Respects user's motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Disable hover transforms */
  .card:hover,
  .btn-primary:hover {
    transform: none;
  }
}
```

**Testing:**
- macOS: System Preferences → Accessibility → Display → Reduce motion
- Windows: Settings → Ease of Access → Display → Show animations
- After enabling, refresh page - hover effects should not translate

### High Contrast Mode

Enhanced contrast for better visibility:

```css
@media (prefers-contrast: high) {
  /* Increase border contrast */
  .card, .input {
    border-width: 2px;
  }

  /* Strengthen text contrast */
  .card-description {
    color: var(--color-ash);
  }

  /* Make focus indicators more visible */
  *:focus-visible {
    outline-width: 3px;
  }
}
```

### Accessible Modals

Proper modal structure:

```html
<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal-card">
    <h3 id="modal-title">Confirm Action</h3>
    <p>Are you sure you want to continue?</p>
    <div class="modal-actions">
      <button class="btn-secondary">Cancel</button>
      <button class="btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

**Requirements:**
- `role="dialog"` on overlay
- `aria-modal="true"` to indicate modal behavior
- `aria-labelledby` pointing to modal title
- Focus trap (keyboard focus stays within modal)

### Keyboard Navigation

All interactive elements must be keyboard accessible:

```html
<!-- ✅ GOOD - native button element -->
<button type="button" onClick={handleClick}>
  Click me
</button>

<!-- ✅ GOOD - div with proper keyboard handling -->
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Click me
</div>

<!-- ❌ BAD - div without keyboard support -->
<div onClick={handleClick}>
  Click me
</div>
```

---

## Usage Examples

### Complete Form Example

```html
<form>
  <div class="form-group">
    <label class="label label-required" for="email">Email Address</label>
    <input
      type="email"
      id="email"
      class="input"
      placeholder="you@example.com"
      required
      aria-required="true"
    />
    <p class="helper-text">We'll never share your email</p>
  </div>

  <div class="form-group">
    <label class="label" for="message">Message</label>
    <textarea
      id="message"
      class="input"
      rows="4"
      placeholder="Tell us about your project..."
    ></textarea>
  </div>

  <div class="form-group">
    <label class="label" for="category">Category</label>
    <select id="category" class="select">
      <option>Support</option>
      <option>Sales</option>
      <option>Feedback</option>
    </select>
  </div>

  <button type="submit" class="btn-primary btn-full-width">
    Send Message
  </button>
</form>
```

### Dashboard Card Grid

```html
<section aria-labelledby="tools-heading">
  <h2 id="tools-heading" class="eyebrow">Tools</h2>

  <div class="card-grid">
    <Link
      href="/media-library"
      class="card card-teal"
      role="article"
      aria-label="Media Library: Upload and organize private assets"
    >
      <div class="card-header">
        <div class="card-icon card-icon-teal">
          <svg><!-- Icon --></svg>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">Media Library</h3>
        <p class="card-description">
          Upload and organize private assets with per-user Supabase storage.
        </p>
      </div>
      <div class="card-footer">
        <span class="card-meta">Open library →</span>
      </div>
    </Link>

    <Link
      href="/ai-studio"
      class="card card-interactive"
      role="article"
      aria-label="AI Studio: Generate and iterate images and videos"
    >
      <div class="card-header">
        <div class="card-icon card-icon-amber">
          <svg><!-- Icon --></svg>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">AI Studio</h3>
        <p class="card-description">
          Generate and iterate images/videos with prompt systems and models.
        </p>
      </div>
      <div class="card-footer">
        <span class="card-meta">Open studio →</span>
      </div>
    </Link>
  </div>
</section>
```

### Hero Section with Quick Actions

```html
<section class="dashboard-hero">
  <div class="hero-primary">
    <div class="hero-copy">
      <h1>Welcome back, <span>John</span></h1>
      <p class="hero-subtext">
        Your dashboard is the launch surface for analytics, creator ops,
        and storage—built for fast decisions and secure tooling.
      </p>
    </div>

    <div class="hero-quick-row">
      <Link
        href="/onboarding"
        class="hero-onboarding"
        aria-label="Onboarding Courses: Guided walkthroughs for Creator Studio workflows"
      >
        <div>
          <p class="eyebrow tiny">Quick start</p>
          <h3>Onboarding Courses</h3>
          <p class="subdued tiny">
            Guided walkthroughs for Creator Studio workflows.
          </p>
        </div>
        <span>Enter →</span>
      </Link>

      <Link
        href="/workflows"
        class="hero-onboarding hero-workflow-card"
        aria-label="AI Workflow Lessons: Deep dives on creation playbooks"
      >
        <div>
          <p class="eyebrow tiny">Workflows</p>
          <h3>AI Workflow Lessons</h3>
          <p class="subdued tiny">
            Deep dives on creation playbooks and applied prompts.
          </p>
        </div>
        <span>Explore →</span>
      </Link>
    </div>
  </div>
</section>
```

### Modal with Accessibility

```tsx
{showModal && (
  <div
    className="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-title"
  >
    <div className="modal-card">
      <h3 id="delete-title">Confirm Deletion</h3>
      <p className="subdued">
        Are you sure you want to delete this file? This action cannot be undone.
      </p>

      {error && (
        <div className="auth-error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <div className="modal-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={handleConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  </div>
)}
```

---

## Best Practices

### DO ✅

1. **Always use design tokens:**
   ```css
   padding: var(--spacing-12) var(--spacing-16);
   border-radius: var(--radius-lg);
   ```

2. **Use semantic HTML:**
   ```html
   <section aria-labelledby="heading">
     <h2 id="heading">Section Title</h2>
   </section>
   ```

3. **Include ARIA labels on interactive elements:**
   ```html
   <button aria-label="Delete file: vacation.jpg">
     <TrashIcon />
   </button>
   ```

4. **Use component classes:**
   ```html
   <button class="btn-primary">Save</button>
   <div class="card">...</div>
   ```

5. **Add skip links to every page:**
   ```html
   <a href="#main-content" class="skip-link">Skip to main content</a>
   ```

6. **Use ARIA live regions for dynamic content:**
   ```html
   <div role="status" aria-live="polite">
     {uploadStatus}
   </div>
   ```

7. **Test keyboard navigation:**
   - Press Tab through all interactive elements
   - Verify focus outlines are visible
   - Ensure all actions are accessible via keyboard

### DON'T ❌

1. **Don't hardcode spacing values:**
   ```css
   /* ❌ BAD */
   padding: 13px 17px;

   /* ✅ GOOD */
   padding: var(--spacing-12) var(--spacing-16);
   ```

2. **Don't create custom button styles:**
   ```css
   /* ❌ BAD */
   .my-custom-button {
     background: blue;
     padding: 10px 15px;
   }

   /* ✅ GOOD */
   <button class="btn-primary">Click me</button>
   ```

3. **Don't skip semantic HTML:**
   ```html
   <!-- ❌ BAD -->
   <div class="eyebrow">Tools</div>

   <!-- ✅ GOOD -->
   <h2 id="tools-heading" class="eyebrow">Tools</h2>
   ```

4. **Don't make divs clickable without keyboard support:**
   ```html
   <!-- ❌ BAD -->
   <div onClick={handleClick}>Click me</div>

   <!-- ✅ GOOD -->
   <button onClick={handleClick}>Click me</button>
   ```

5. **Don't use excessive opacity levels:**
   ```css
   /* ❌ BAD - too many opacity variations */
   border: 1px solid rgba(201, 205, 214, 0.17);

   /* ✅ GOOD - use standard opacity levels */
   border: 1px solid rgba(201, 205, 214, 0.16);
   ```

6. **Don't overuse gradients:**
   ```css
   /* ❌ BAD - gradient on content card */
   .card {
     background: linear-gradient(...);
   }

   /* ✅ GOOD - solid fill for content focus */
   .card {
     background: rgba(18, 21, 29, 0.85);
   }
   ```

---

## Migration Guide

### For New Features

When building new components or pages:

1. **Start with design tokens** - Use spacing, typography, and color tokens
2. **Use component classes** - Check if `.btn-primary`, `.card`, `.input` meet your needs
3. **Add accessibility** - Include skip links, ARIA labels, and semantic HTML
4. **Test keyboard navigation** - Press Tab to verify focus states
5. **Check reduced motion** - Test with motion preferences disabled

### For Existing Code

When updating old components:

1. **Replace hardcoded values with tokens:**
   - Find: `padding: 12px 16px;`
   - Replace: `padding: var(--spacing-12) var(--spacing-16);`

2. **Replace old button classes:**
   - `.ghost-btn` → `.btn-secondary`
   - `.primary-btn` → `.btn-primary`
   - `.danger-btn` → `.btn-danger`

3. **Add skip links:**
   ```html
   <a href="#main-content" class="skip-link">Skip to main content</a>
   <main id="main-content">
   ```

4. **Improve semantic HTML:**
   - `<div class="eyebrow">` → `<h2 class="eyebrow">`
   - Add `role="article"` to cards
   - Add `aria-label` to interactive elements

5. **Add ARIA live regions:**
   ```html
   {uploading && (
     <div role="status" aria-live="polite">
       Uploading files...
     </div>
   )}
   ```

### Common Replacements

| Old Class | New Class | Notes |
|-----------|-----------|-------|
| `.ghost-btn` | `.btn-secondary` | Ghost style button |
| `.primary-btn` | `.btn-primary` | Primary CTA button |
| `.danger-btn` | `.btn-danger` | Destructive action |
| `.tool-card` | `.card` | Use base card class |
| `.media-card` | `.card` | Use base card class |
| Custom padding | `var(--spacing-*)` | Use spacing tokens |
| Custom border-radius | `var(--radius-*)` | Use radius tokens |

---

## File Structure

```
frontend/styles/
├── design-tokens.css          # Design tokens (spacing, typography, shadows)
├── foundation.css             # Core foundations (colors, resets, layout)
├── components-buttons.css     # Button component system
├── components-cards.css       # Card component system
├── components-inputs.css      # Input component system
├── accessibility.css          # Accessibility features
├── ui-patterns.css            # Shared UI patterns
├── workspace-dashboard.css    # Dashboard-specific styles
├── workspace-media.css        # Media Library-specific styles
├── ai-studio-layout.css       # AI Studio reference (gold standard)
└── globals.css                # Global imports
```

---

## Testing Checklist

Before deploying design changes:

### Visual Regression
- [ ] Take screenshots before/after changes
- [ ] Compare hover states
- [ ] Verify spacing consistency
- [ ] Check focus states

### Keyboard Navigation
- [ ] Press Tab through all interactive elements
- [ ] Verify cyan focus outlines appear
- [ ] Test skip link (Tab on page load)
- [ ] Verify Enter/Space keys trigger actions

### Screen Reader
- [ ] Test with VoiceOver (Mac) or NVDA (Windows)
- [ ] Verify ARIA labels are announced
- [ ] Test live regions for dynamic content
- [ ] Verify modal focus trap

### Reduced Motion
- [ ] Enable "Reduce motion" in system preferences
- [ ] Refresh page
- [ ] Verify hover transforms are disabled
- [ ] Check animations are minimal

### Design Token Audit
- [ ] Search for hardcoded pixel values: `grep -r "px" frontend/styles/`
- [ ] Verify 95%+ use design tokens
- [ ] Check no spacing values outside approved scale

### Color Contrast
- [ ] Use WebAIM Contrast Checker
- [ ] Verify all text meets WCAG AA (preferably AAA)
- [ ] Test with color blindness simulator

### Cross-Browser
- [ ] Test in Chrome, Firefox, Safari, Edge
- [ ] Verify focus-visible works correctly
- [ ] Check gradients, shadows, transitions render correctly

---

## Success Metrics

Track these after implementing the design system:

### Design Consistency
- ✅ Spacing violations: 0 (all use design tokens)
- ✅ Color inconsistencies: 0 (all use semantic tokens)
- ✅ Border radius values: ≤8 unique values
- ✅ Shadow variations: ≤5 unique values
- ✅ Hover translateY values: 1-2 only (-1px subtle, -2px standard)

### Accessibility
- ✅ WCAG 2.1 Level AA compliance: 100%
- ✅ Focus-visible coverage: 100% of interactive elements
- ✅ ARIA coverage: 100% of dynamic content
- ✅ Keyboard navigation: All features accessible
- ✅ Reduced motion support: All animations respect user preference

### Performance
- ✅ CSS file size reduction: 20%+ (remove redundant styles)
- ✅ Paint time: Maintained or improved
- ✅ Cumulative Layout Shift: ≤0.1

### Developer Experience
- ✅ CSS file organization: 15-20 focused files
- ✅ Token usage: 95%+ of styles use design tokens
- ✅ Code review feedback: Reduced design questions by 50%

---

## Reference Implementation

**AI Studio** (`frontend/styles/ai-studio-*.css`) serves as the reference for all design decisions:

- **Spacing system:** `ai-studio-layout.css:11-12` - `--ai-rail-width`, `--ai-gutter`
- **Focus-visible states:** `ai-studio-layout.css:868-882`
- **Reduced motion:** `ai-studio-layout.css:744-765`
- **Multi-layer shadows:** `ai-studio-layout.css:791-793`
- **Sticky positioning:** `ai-studio-layout.css:568-569`
- **Namespaced tokens:** `ai-studio-layout.css:9-25`
- **Button gradients:** `ai-studio-layout.css:770-804`
- **Cubic-bezier transitions:** `ai-studio-layout.css:734`

When in doubt, refer to AI Studio patterns.

---

## Questions?

For questions or suggestions about the design system:

1. Review AI Studio implementation in `frontend/styles/ai-studio-*.css`
2. Check existing component classes in `frontend/styles/components-*.css`
3. Consult accessibility guidelines in `frontend/styles/accessibility.css`
4. Open an issue with the `design-system` label

---

**Last Updated:** February 2026
**Maintainers:** Design System Team
**Status:** ✅ Production Ready
