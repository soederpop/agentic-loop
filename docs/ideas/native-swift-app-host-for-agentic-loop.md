---
goal: user-experience-improvements
tags:
  - distribution
  - macos
  - swift
  - packaging
  - onboarding
status: exploring
---

# Native Swift App Host For Agentic Loop

Build a native macOS Swift application that installs, launches, and manages the Agentic Loop as a desktop product. The app would act as a first-run installer, service manager, status dashboard, and settings surface for the existing Luca-based system rather than rewriting the core orchestration logic in Swift.

The likely architecture is a native Swift shell around downloaded or bundled compiled Bun binaries for `luca` and `cnotes`, with future room to absorb or replace some helper tools with native implementations over time.

## Motivation

Today the Agentic Loop is powerful but still feels like a developer-operated system. Setup depends on shell scripts, PATH configuration, external CLIs, and machine-level assumptions around Bun, voice tools, and other helpers. That makes onboarding harder than it needs to be and limits how cleanly the product can be distributed to non-technical users.

A native macOS host app could make the system feel like a real desktop product:

- users download one app
- first-run setup installs or downloads the required Luca/contentbase binaries
- the app manages paths, config, logs, updates, and process lifecycle
- onboarding, permissions, and diagnostics happen in a guided native UI
- the existing Agentic Loop architecture remains mostly intact

This appears especially well aligned with the UX goal because the core binaries already support standalone distribution, while the current pain comes mostly from setup friction and dependency management rather than a fundamental architectural mismatch.

## What Seems Promising

- `luca` already supports compilation as a standalone Bun binary
- `cnotes` / contentbase already has a downloadable binary flow
- the repo already includes a native macOS app surface in `apps/presenter-windows`
- `luca main` is already a natural process boundary for a native launcher/manager app
- direct-download notarized macOS distribution looks more realistic than an App Store strategy

## Key Product Shape

A first version would likely:

- ship a native Swift app as the main user-facing product
- download or unpack `luca` and `cnotes` into an app-managed location such as Application Support
- launch `luca main` with explicit paths and controlled environment variables
- provide setup UI for env vars, permissions, assistant configuration, and workflow status
- show logs, health, and repair/install guidance in-app
- treat voice as optional or progressive rather than required for first-run success

## Technical Challenges To Explore

### Runtime Assumptions To Remove Or Reduce

The current system still assumes:

- tools are available on PATH
- shell scripts are available and appropriate
- shell startup files may be sourced
- subprocesses can invoke bare command names like `luca`
- external CLIs exist for some features

A native app host would be much more robust if the loop used explicit managed tool paths instead of PATH-first discovery.

### Voice Stack Complexity

The biggest packaging friction is the voice stack, especially:

- `mlx_whisper`
- `rustpotter`
- `sox`

A native app probably should not require wake word setup on first run. A better product shape may be:

- text-first install success
- optional push-to-talk or continuous listening
- wake word as a later enhancement

There is also a question of whether speech-to-text and wake-word functionality should stay as managed helper binaries at first, or be replaced over time with Swift/native libraries or Apple platform frameworks.

### Distribution Model

Direct-download notarized distribution seems like the most realistic first path. The Mac App Store may be much harder because of sandboxing, downloaded executables, helper tools, and automation-heavy capabilities.

## Open Questions

- Should the app bundle `luca` and `cnotes`, or download the latest compatible binaries on first launch?
- Should helper binaries like `rustpotter` remain external managed tools, or be bundled too?
- Can the scheduler and task runner stop assuming `luca` is globally available on PATH?
- What is the minimum viable voice experience for a desktop app version?
- Is Apple Speech or another native/local stack good enough to replace `mlx_whisper` in an early version?
- Should wake word be deferred entirely in the native product until a cleaner native path exists?
- What app-managed config format should replace shell-oriented setup assumptions?

## Success Looks Like

- a non-technical Mac user can install one app and get to a working Agentic Loop setup without using Terminal
- the app can install/manage `luca` and `cnotes` without relying on global shell setup
- `luca main` can be hosted cleanly by the app with reliable lifecycle control and diagnostics
- the default onboarding path succeeds even if advanced voice features are unavailable
- the architecture preserves the current Luca-based investment instead of forcing a rewrite
