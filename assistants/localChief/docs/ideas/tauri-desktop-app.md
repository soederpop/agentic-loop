---
status: exploring
goal: have-10-users-of-the-agentic-loop
---

# Build a Tauri Desktop App

I've analyzed the stack used by the app voicebox.sh

Yep — I found the open-source repo behind voicebox.sh, and the app stack is pretty clear from their docs and package files. At a high level, Voicebox is a desktop app built with Tauri, with a React + TypeScript frontend and a Python FastAPI backend that talk over HTTP.

Core app stack

Desktop shell: Tauri with a Rust layer, which they explicitly call out as “native performance” instead of Electron.
Frontend: React 18 + TypeScript. Their architecture doc names React 18/TS, and the app package uses React 18, Vite, and @vitejs/plugin-react.
Frontend state/data: Zustand for state and TanStack React Query for server data; they also use TanStack Router.
Styling/UI: Tailwind CSS, plus a lot of Radix UI primitives, class-variance-authority, clsx, and tailwind-merge.
Audio/UI widgets: WaveSurfer.js is explicitly listed in the docs, and the app package also includes react-sound-visualizer.

Backend / ML stack

API server: FastAPI on Python 3.11+, typically run with Uvicorn.
Database: SQLite with SQLAlchemy.
Audio processing: librosa and soundfile.
ML/runtime: PyTorch (torch, torchvision) plus Hugging Face Hub for model fetching.
Speech models: the docs call out Qwen3-TTS as the main TTS model and Whisper for transcription; the repo README also lists multiple supported TTS engines: Qwen3-TTS, LuxTTS, Chatterbox Multilingual, Chatterbox Turbo, and HumeAI TADA.

Build/tooling

The repo is a monorepo/workspace with app, tauri, web, and landing packages.
JS package manager/runtime is Bun (packageManager: bun@1.3.8), and the dev/build scripts are Bun-based.
Frontend build uses Vite. The app package uses vite for dev/build, and the Docker build runs bunx --bun vite build.
Linting/formatting uses Biome.

Deployment/runtime

They support local desktop runtimes and Docker. The README says it runs on macOS with MLX/Metal, Windows with CUDA, Linux, AMD ROCm, Intel Arc, and Docker.
The Docker image is a 3-stage build: frontend on oven/bun, Python deps on python:3.11-slim, then a slim Python runtime with ffmpeg and the built frontend copied in. The container launches uvicorn backend.main:app.

So the cleanest summary is:

Voicebox stack = Tauri (Rust shell) + React/TypeScript/Vite/Tailwind frontend + FastAPI/Python/PyTorch backend + SQLite, with local TTS/STT models and audio tooling.

If useful, I can turn this into a more opinionated teardown next — for example: “what parts are commodity vs. custom,” or “how you’d clone this architecture for your own app.”

What is Tauri?

Tauri is a framework for building desktop applications using web technologies (HTML/CSS/JS) paired with a native Rust backend.

Think of it as an alternative to Electron—but with a very different philosophy.

🧠 The core idea

Instead of bundling an entire browser (like Electron does with Chromium), Tauri:

Uses the system’s native webview (Safari WebKit on macOS, WebView2 on Windows, etc.)
Wraps it in a small Rust-based native shell
Lets your frontend (React, Vue, etc.) talk to Rust for system-level tasks
🧱 What the stack looks like

A typical Tauri app (like voicebox.sh) is:

Frontend: React / Vue / Svelte (runs in a webview)
Backend: Rust (handles filesystem, OS APIs, performance stuff)
Bridge: Secure message passing between JS ↔ Rust
⚖️ Why people use Tauri (vs Electron)
✅ Pros
Much smaller apps
Electron apps: ~100–200MB
Tauri apps: often <10MB
Lower memory usage
No bundled Chromium
Better performance
Rust backend + native webview
More secure by default
Explicit API allowlists between frontend/backend
❌ Tradeoffs
More complexity
You now have Rust + frontend instead of just Node
Ecosystem is smaller
Electron has more plugins/libraries
Webview differences
Slight inconsistencies across OSes
🔌 How it actually works (simplified)
Your React app runs inside a native webview

When it needs system access (files, audio, etc.), it calls:

invoke("some_rust_command")

Rust handles it:

#[tauri::command]
fn some_rust_command() { ... }
Result gets sent back to the frontend
🧩 Where it fits in the landscape
Tool	Backend	Renderer	Size	Notes
Electron	Node	Chromium	Large	Most mature
Tauri	Rust	System webview	Small	Lean, modern
Flutter	Dart	Skia	Medium	Fully custom UI
Native apps	C++/Swift/etc.	Native	Small	Max control
🧠 Why Voicebox uses it

For an app like voicebox.sh:

Needs local ML models + audio processing
Needs desktop performance
Wants nice UI with web tools

Tauri gives:

Lightweight desktop shell
Rust for performance-sensitive tasks
Easy React frontend for UI
🪄 Simple analogy
Electron = ship your own browser with your app
Tauri = borrow the user’s browser and add a Rust engine under the hood

If you want, I can break down when you should choose Tauri vs just a web app vs Electron, which is usually the real decision people care about.

Check out https://github.com/soederpop/luca I would like to build an app with tauri that also ships this bun compiled binary that the apps frontend will talk to 
Thought for 5s
Looked for available tools
Thought for 12s
Thought for 21s
Thought for 25s
Thought for 29s

I tried to open https://github.com/soederpop/luca directly, but GitHub returned a 404 from my side, so I could not inspect the repo contents itself.

That said, what you want to build is a very normal Tauri pattern: ship Luca as a bundled sidecar binary, then let the frontend talk to it either through stdio, HTTP on localhost, or a Rust bridge. Tauri officially supports bundling external executables as sidecars via bundle.externalBin, and the bundled binary needs platform-specific target-suffixed filenames.

Since Luca is a Bun-compiled binary, that part also fits cleanly: Bun supports generating a standalone executable from TS/JS with bun build ... --compile, bundling the app code plus the Bun runtime into a single binary.

The architecture I’d recommend is:

Frontend: React/Vite in Tauri.
Desktop shell: Tauri.
Bundled engine: your Luca Bun binary as a Tauri sidecar.
Communication layer: preferably Tauri Rust commands for lifecycle management, and then either:
HTTP localhost if Luca is server-shaped, or
stdio streaming if Luca is CLI/agent-shaped.
Tauri’s command system is the standard way for the frontend to call into Rust, and Tauri also supports channels/events for sending data back to the frontend.

For your use case, I would not have the frontend launch or manage the sidecar directly unless the app is very simple. A better setup is:

the frontend invokes Rust
Rust starts/stops Luca
Rust tracks PID/health/readiness
frontend talks to Rust, and Rust proxies or orchestrates Luca

That gives you cleaner startup, logging, restart behavior, and fewer “port already in use / zombie process / binary path” headaches. This is consistent with how Tauri’s sidecar model is intended to be used.

Best communication choice

If Luca exposes an API server
Use this shape:

Tauri starts the Bun binary with serve --port <ephemeral port>
Rust waits for readiness
frontend uses fetch("http://127.0.0.1:PORT/...")

This is the easiest if Luca already thinks in requests/responses.

If Luca is more like a command runner / AI worker / stream processor
Use this shape:

Tauri starts Luca as a long-lived sidecar
frontend sends requests to Rust with invoke
Rust writes to Luca stdin / reads stdout
Rust emits progress/events back to the UI

That is better when you need streaming, incremental logs, or one-process ownership.

A solid project layout
my-app/
  src/                  # React frontend
  src-tauri/
    src/
      main.rs
      luca.rs           # sidecar lifecycle + API bridge
    binaries/
      luca-x86_64-apple-darwin
      luca-aarch64-apple-darwin
      luca-x86_64-pc-windows-msvc.exe
      luca-x86_64-unknown-linux-gnu
    tauri.conf.json
  packages/
    luca/               # bun source for the engine
Tauri config idea

Tauri bundles sidecars using externalBin. The binary names need the target triple suffix.

{
  "bundle": {
    "externalBin": ["binaries/luca"]
  }
}
Rust-side lifecycle

In practice, create commands like:

start_luca()
stop_luca()
luca_status()
luca_request(payload)

If using sidecars directly, Tauri’s shell plugin supports spawning a sidecar and passing validated args.

Conceptually:

#[tauri::command]
async fn start_luca(app: tauri::AppHandle) -> Result<u16, String> {
    // pick port
    // spawn sidecar with args
    // wait for readiness
    // store child handle + port in app state
    // return port
}

And the frontend calls it with Tauri invoke(...).

Build pipeline

A clean build flow would be:

Build Luca with Bun:

bun build ./src/index.ts --compile --outfile ./dist/luca

Bun supports this standalone executable flow directly.

Rename/copy it into src-tauri/binaries/ with the right target suffix Tauri expects. Tauri documents this exact naming convention.
Run tauri build.
My opinionated recommendation

For your app, I’d choose this:

Luca runs as a localhost HTTP server
Rust launches it and monitors it
Frontend talks to Luca over HTTP
Frontend talks to Rust only for native capabilities and process control

Why:

simpler request model
easier debugging with curl/Postman/browser devtools
easier future reuse of Luca outside desktop
cleaner separation between “app shell” and “engine”

I’d only choose stdio-only if Luca is fundamentally a CLI pipeline or you need tight streaming semantics.

Biggest gotchas

The parts most likely to bite you are:

cross-platform binary builds for Bun
Tauri target-suffixed sidecar naming
codesigning/notarization on macOS
Windows Defender / SmartScreen friction for bundled executables
process shutdown when the app window closes
port management if Luca is an HTTP server

Tauri’s docs are explicit that sidecars are bundled per target and must match the target triple naming convention.

Bottom line

Yes — this architecture is very doable, and it’s probably the right way to package Luca into a desktop app.

The stack I’d use is:

Tauri
React + Vite
Bun-compiled Luca binary
Rust lifecycle wrapper
HTTP over localhost between frontend and Luca

Because I could not access the repo itself, I have not verified whether Luca is already server-based or CLI-based. If you share the repo contents or paste its package.json / entrypoint, I can turn this into a concrete integration plan with exact file changes.