---
tags: []
status: planning
relatedReports: []
---

# React Ink and Anthropic Skills Research

## Scope
- Ink GitHub source/repo docs: architecture and implementation details that matter for rendering, reconciliation, input handling, layout, and testing.
- Anthropic Skills docs/examples: patterns and expectations for a future `SKILL.md`, especially tooling, structure, and usage guidance.
- Ink official docs: core APIs, components, hooks, and best practices for CLI interfaces.

## Findings

### 1) What Ink is and when it fits
- Ink is a custom React renderer for command-line interfaces. It explicitly positions itself as “React for CLIs” and uses Yoga for Flexbox-based terminal layout, so the mental model is React components + Flexbox, not ad hoc cursor math.[1][2]
- Ink is now at version 7.0.0 in the repo, published as pure ESM, and requires Node.js >=22. Any future `SKILL.md` should call out this environment assumption clearly so users do not try old CommonJS / older-Node setups.[3]
- Ink is already used for sophisticated agentic CLIs (the README explicitly names Claude Code and Gemini CLI), which is a strong signal that it is suitable for rich interactive developer tools rather than only toy demos.[2]

### 2) Public API surface most relevant to builders
- The package exports `render()` and `renderToString()`, core layout/display primitives (`Box`, `Text`, `Static`, `Transform`, `Newline`, `Spacer`), and hooks for input, app lifecycle, streams, focus, cursor, animation, terminal size, and box measurement.[4]
- The README’s documented core primitives align with those exports: `Text`, `Box`, `Newline`, `Spacer`, `Static`, `Transform`, plus hooks like `useInput`, `usePaste`, `useApp`, `useStdin`, `useStdout`, `useStderr`, `useWindowSize`, `useFocus`, `useFocusManager`, `useCursor`, `useAnimation`, and `useBoxMetrics`.[2]
- For a practical skill file, this means the “recommended primitives” section should be narrow and opinionated: usually `Box` + `Text` for layout and presentation, `useInput` for keyboard interaction, `useApp` for exit control, `Static` for append-only logs, and `useStdout`/`useStderr` for side-channel output.[2][4]

### 3) Important component patterns from the docs
- `Text` is strictly text-oriented: it allows text nodes and nested `Text`, but not `Box` inside it. This is a foundational composition constraint worth stating explicitly in any how-to guidance.[2][7]
- `Box` is the central layout primitive, effectively terminal `display:flex`, with extensive Yoga-backed support for dimensions, padding, margin, gap, flex properties, alignment, positioning, borders, overflow, and background color.[2]
- `Static` is purpose-built for output that should be rendered once and remain above the live app (completed tasks, logs, history). Importantly, it only renders newly added items and ignores rerenders of prior items, which can surprise people if they treat it like normal React stateful output.[2][7]
- `Transform` exists for string-level post-processing of rendered text, but the docs warn that it should only wrap `Text` children and should not change output dimensions; ANSI-aware string handling matters if styling is involved.[2]

### 4) Lifecycle and runtime behavior that will affect real apps
- An Ink app is still just a Node.js process. It remains alive only while something is active in the event loop (timers, pending promises, input listeners, etc.), so a component tree with no ongoing work will render once and exit immediately.[2]
- Exit can be triggered by Ctrl+C, `useApp().exit()`, or `unmount()` from the render instance; `waitUntilExit()` is the documented way to run follow-up logic after unmount.[2][5]
- Render instances should not be multiplexed on the same `stdout`: Ink maintains one live renderer per stdout stream and warns that reusing the same stream across multiple `render()` calls without unmounting is unsupported.[5]

### 5) Rendering architecture from the source
- Ink builds a custom host tree (`ink-root`, `ink-box`, `ink-text`, `ink-virtual-text`, `#text`) and applies Yoga layout to that tree before converting it to terminal output. Text nodes are measured and wrapped through dedicated measurement logic, not browser layout.[6][8]
- The renderer is built with `react-reconciler` and supports both legacy and concurrent roots (`LegacyRoot` / `ConcurrentRoot`). In legacy mode it uses sync container updates; in concurrent mode it uses scheduled async updates.[6][7]
- After each commit, the reconciler computes layout, emits layout listeners, and then triggers render. `Static` has a special fast path (`onImmediateRender`) so static output is flushed before those nodes are erased by subsequent tree updates.[7]
- This architecture suggests a future `SKILL.md` should explain Ink as: React component tree -> custom DOM nodes -> Yoga layout -> string rendering/log-update. That framing will help users reason about why some browser intuitions transfer and others do not.[6][7][8]

### 6) Interactive vs non-interactive behavior
- Ink auto-detects whether it is in an interactive environment using CI detection and `stdout.isTTY`, and disables many terminal control behaviors in non-interactive mode. In non-interactive/CI mode it generally writes only the final frame at unmount rather than continuously repainting.[5][6][13]
- In interactive mode, Ink supports cursor manipulation, synchronized output, resize handling, alternate screen, and kitty keyboard auto-detection. In non-interactive mode, those are disabled.[5][6]
- This is a major practical constraint for testing, logging, and CI usage. A good skill should tell users to think deliberately about whether their CLI is intended for human-interactive TTY use, CI logs, or both.[5][13]

### 7) Input handling, raw mode, focus, and paste
- `useInput` enables raw mode while active, parses keypresses, and exposes a normalized `key` object including arrows, paging keys, modifiers, and kitty keyboard protocol metadata. Updates are wrapped in `reconciler.discreteUpdates`, giving keyboard-driven state changes high priority in concurrent mode.[9]
- The internal `App` component reference-counts raw mode so multiple hooks/components can safely depend on it without stomping one another. It also reference-counts bracketed paste mode and routes paste events separately from normal key input.[12]
- `usePaste` is therefore not just syntactic sugar: it reflects a distinct event channel so pasted content is not misinterpreted as a sequence of keystrokes when active.[2][12]
- Focus management is built around `useFocus` and a shared `FocusContext`; focusable components are registered in render order, Tab / Shift+Tab navigation is managed centrally, and components can be auto-focused, deactivated, or focused programmatically by id.[10][12]
- For a future `SKILL.md`, the likely advice is: use `useInput` for global shortcuts and simple controls, `useFocus` for multi-widget interfaces, and `usePaste` when accepting multiline or bulk text input.[2][9][10][12]

### 8) Performance-related behaviors worth encoding into best practices
- Ink throttles rendering by default using `maxFps` (default 30). Screen-reader mode and debug mode disable throttling. Rendering and log updates are both throttled to limit repaint frequency.[5][6]
- `useAnimation` uses a shared timer system so multiple animations coalesce into one render cycle rather than each spinning their own timers. It exposes `frame`, `time`, and `delta`, and it cooperates with render throttling to avoid wasteful intermediate frames.[11][12]
- Incremental rendering is an opt-in mode intended to update only changed lines rather than redrawing everything, which can reduce flicker for frequently updating UIs.[5]
- These details imply practical guidance: avoid bespoke high-frequency timers everywhere; prefer `useAnimation`; use `Static` for immutable history; and only opt into advanced rendering modes when the use case actually benefits.[5][11][12]

### 9) Accessibility and screen reader implications
- Ink has explicit screen reader support, enabled via `render(..., {isScreenReaderEnabled: true})` or `INK_SCREEN_READER=true`, and supports a subset of ARIA-like metadata via `aria-label`, `aria-hidden`, `aria-role`, and `aria-state`.[13]
- The internal DOM model stores accessibility metadata directly on nodes, confirming that this is not just surface documentation but part of the renderer design.[8]
- The docs explicitly recommend using `useIsScreenReaderEnabled` and rendering more descriptive output when needed. A skill file should encourage accessible output for widgets like checkboxes, progress bars, and selection UIs.[4][13]

### 10) Testing and debugging guidance from the official docs/source
- Official docs recommend `ink-testing-library` for component testing, with frame-based assertions like `lastFrame()`.[13]
- Devtools support is opt-in through `react-devtools-core` plus `DEV=true`; the reconciler source conditionally loads devtools support in development mode to avoid unwanted interference.[13][7]
- Because concurrent mode changes render timing, the render docs note that tests may need `act()` to await updates properly.[5]
- A future skill should probably include a “testing checklist”: snapshot/frame tests for pure rendering, simulated input for interaction, and explicit notes about `act()`/async timing when concurrent mode or animations are involved.[5][13]

### 11) What Anthropic Skills docs/examples suggest for SKILL.md design
- Anthropic’s repository defines a skill as a self-contained folder with a `SKILL.md` plus optional scripts/resources; the minimal required structure is YAML frontmatter (`name`, `description`) followed by instruction content.[14][15]
- The template is intentionally tiny, but `skill-creator` shows the real pattern: put trigger guidance in the `description`, keep the body imperative and task-oriented, and use bundled resources/scripts for large or deterministic material rather than overloading the main markdown file.[15][16]
- `skill-creator` also recommends “progressive disclosure”: metadata always loaded, `SKILL.md` body loaded on trigger, bundled resources loaded as needed. It suggests keeping `SKILL.md` under ~500 lines when possible and moving bulky references into subfiles with clear pointers.[16]
- The same example explicitly says descriptions should be somewhat “pushy” to improve triggering and should include both what the skill does and when to use it.[16]

### 12) Concrete implications for an Ink-focused SKILL.md
A good `SKILL.md` for React Ink should probably include:
- Frontmatter with a name like `react-ink` and a description that names trigger contexts explicitly: building terminal UIs, interactive CLIs, dashboards, menus, progress displays, keyboard navigation, and testing Ink apps.[15][16]
- A short “when to use / when not to use” section, especially distinguishing Ink from simpler chalk-only scripts and from browser React apps.[2][3]
- A recommended stack and environment section: React 19+, Ink 7.x, Node 22+, ESM, optional `react-devtools-core`, `ink-testing-library` for tests.[3][13]
- A public-API cheat sheet emphasizing the small set of primitives most users need first.[2][4]
- A “design rules” section covering `Text` vs `Box`, `Static` semantics, interactive vs CI behavior, raw-mode caveats, stdout reuse constraints, and accessibility basics.[2][5][7][8][13]
- Links/pointers to examples and perhaps bundled reference files for advanced areas like focus management, animation, alternate screen, and testing.[2][16]

## Open questions / caveats
- The README documents the upcoming version and points npm users to the latest stable release, so version-specific guidance in a future `SKILL.md` should be checked against the actual version being used in the target project.[2]
- The repository currently requires Node >=22, but some downstream projects may still be on Ink 6.x or earlier. A skill should either scope itself explicitly to Ink 7+ or include a compatibility note.[3]
- The parallel research job failed due to tool-call execution issues, so all conclusions above are based on direct manual inspection rather than forked subresearch results.

## Sources
[1] Ink GitHub repository overview
[2] Ink README
[3] Ink package.json
[4] Ink src/index.ts exports
[5] Ink src/render.ts
[6] Ink src/ink.tsx
[7] Ink src/reconciler.ts
[8] Ink src/dom.ts
[9] Ink src/hooks/use-input.ts
[10] Ink src/hooks/use-focus.ts
[11] Ink src/hooks/use-animation.ts
[12] Ink src/components/App.tsx
[13] Ink README testing/devtools/accessibility/CI sections
[14] Anthropic skills repository README
[15] Anthropic template SKILL.md
[16] Anthropic skill-creator SKILL.md
