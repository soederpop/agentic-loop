---
agent: claude
createdBy: chief
running: false
lastRanAt: 1773954496460
---

# Conditions

* **Outcome**: Create a simple static website that can be served locally.
* **Target output directory**: `examples/example-claude-code-build/`
* **Do not** add any backend/server code; static assets only.

# Requirements

1. **Site files**
   * Create (or overwrite) these files under `examples/example-claude-code-build/`:
     * `index.html`
     * `styles.css`
     * `script.js`
     * `README.md`

2. **Website content**
   * A single-page marketing-style layout with:
     * Header with site name + simple nav links (anchor links).
     * Hero section with headline, short paragraph, and primary CTA button.
     * 3 feature cards.
     * A small FAQ section (accordion is optional; can be simple).
     * Footer with copyright.
   * Keep copy generic (no need to reference Agentic Loop unless you want to).

3. **Behavior (JS)**
   * Smooth scroll for nav anchor links.
   * CTA button scrolls to a section (e.g. Features).
   * Optional: light/dark theme toggle persisted in `localStorage`.

4. **Styling (CSS)**
   * Responsive layout (mobile-first).
   * Use system fonts; no external CSS frameworks.
   * Make it look clean and modern (spacing, max-width container, subtle shadows).

5. **Serving instructions**
   * `examples/example-claude-code-build/README.md` must include exact commands for:
     * serving via Python (`python3 -m http.server`)
     * serving via Node (`npx serve`)
   * Include how to open the site in a browser.

# Acceptance Criteria

* Opening `examples/example-claude-code-build/index.html` in a browser shows a styled, readable landing page.
* Nav links and CTA work.
* No build step required.
* No external dependencies required to *view* the site.
