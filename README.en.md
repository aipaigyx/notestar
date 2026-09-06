# NoteStar · 二次元网课笔记工具 (Anime-Styled Online-Course Notes Tool)

<div align="center">

**🌐 Language / 语言： [English](README.en.md) · [中文](README.md)**

</div>

> **中文**: 一款本地优先的二次元风格网课笔记与复习桌面工具——录屏即自动跟拍成带时间轴的 AI 识别笔记，全程离线。详见**[中文 README](README.md)**。

---

A **local-first** desktop tool for taking notes and reviewing online courses, wrapped in an anime-inspired visual style.

The product turns the full learning loop of "watching online courses → taking notes → reviewing" into something **visually delightful and fully offline**. The UI follows a fantasy anime aesthetic (Amphoreus theme), with its core capabilities built around "**record-screen-to-notes automatically (follow-capture)**" and "**on-device AI understanding & review**" — every AI inference, recognition and transcription runs on your own machine. Note data never leaves your computer.

> The repository keeps the historical code name `notestar` (formerly branded "笔记星图 / NoteStar"); the current product is positioned as an anime-styled online-course notes tool (二次元网课笔记工具).

### How it works in 60 seconds

1. **Open the floating bubble** and click "Record & take notes" — the system will ask for screen-recording permission;
2. **Watch your online course as usual** — the tool silently captures a screen frame every 30 seconds;
3. A **local vision model** (moondream) understands each frame and writes a Chinese description (qwen2.5 translates if needed);
4. Each recognized result is **appended live to a follow-capture note** as `🎥 mm:ss` + screenshot + description;
5. Stop recording → the video is segmented and archived, the session is bound to its note → in the Notes page you can **replay every highlight along the timeline**;
6. After class, the **AI tutor** answers questions, generates quizzes, and links knowledge points via the graph — all grounded in your own notes.

The whole flow is **fully offline** — every AI request is sent to local Ollama only, and your notes / videos stay on your own disk.

---

## Screenshots

| Screen | Description |
|---|---|
| ![Dashboard](docs/screenshots/01-dashboard.png) | **Dashboard**: study stats, Pomodoro focus, review list & AI tutor entry |
| ![Notes](docs/screenshots/02-notes.png) | **Notes (收集火种)**: course-note two-level organization with follow-capture entries |
| ![Knowledge Graph](docs/screenshots/03-graph.png) | **Knowledge Graph (万帷网)**: knowledge-point association driven by local embeddings |
| ![AI Tutor](docs/screenshots/05-assistant.png) | **AI Tutor**: contextual Q&A grounded in the current note |
| ![Blacktide Erosion](docs/screenshots/06-heirs.png) | **Blacktide Erosion skin page**: ink erosion / gold-red sacred flames / ember sparks |
| ![Settings](docs/screenshots/07-settings.png) | **Settings**: AI models / voice / appearance / recording options |

---

## Features

**Visuals & Aesthetics**
- Fantasy anime UI (Amphoreus theme): pink-purple/gold palette, Bento cards, soft glows, fully code-drawn inline-SVG animated logo and nav icons — no image assets required
- Theme skin system: a built-in "Blacktide Erosion" (黑潮侵蚀) card page (`/heirs`) demonstrating ink-devouring edges, black tongues of fire, gold-red sacred flames and ember sparks as real-time CSS/SVG effects — a showcase and playground for skinning
- Unified design tokens for cards / radii / shadows / gradients, making re-skinning straightforward

**Follow-Capture Notes (Desktop Bubble Recording)**
- A system-level desktop floating bubble for one-click "record & take notes" anywhere
- While recording, a frame is captured every 30s → **recognized locally by the moondream vision model** → automatically appended to a note as a timestamped image+text entry (`🎥 mm:ss` + screenshot + Chinese description)
- On stop, the session is archived automatically: video segments, total duration and note binding are persisted so you can replay along the timeline inside the Notes page
- Optimized for low-end devices: low resolution / low frame-rate capture and recognition by default to keep things fluid

**Local-First AI (Ollama)**
- Vision: moondream (screen understanding for follow-capture entries)
- Text / translation: qwen2.5 (Chinese localization of recognition results, Q&A, summarization, expansion, quiz generation, weekly reports)
- Semantic embeddings: nomic-embed-text (cross-course note retrieval and knowledge association)
- Every request is sent only to local `127.0.0.1`; works offline, nothing is uploaded

**Note Organization & Structuring**
- Course → Note two-level organization, Markdown editing (KaTeX math rendering)
- Note enhancement: AI summarization, expansion, mind-map generation, auto-titling
- Export to HTML for sharing and archiving

**Knowledge Network**
- Course / note / knowledge-point graph visualization and association analysis
- Local vector based semantic retrieval across courses

**Review Loop**
- AI-generated quizzes, immersive review mode, due-review reminders (checked hourly)
- AI tutor conversation grounded in the current note context

**Voice Loop**
- Local transcription of follow-capture / course audio (faster-whisper + ffmpeg; runtime bundled on Windows)
- Windows SAPI text-to-speech for listening-based review

**Statistics & Weekly Reports**
- Dashboard with study time, note counts, review progress and weekly learning reports

---

## UI Modules

| Route | Screen | Notes |
|---|---|---|
| `/dashboard` | Dashboard | Study stats, weekly report |
| `/notes` | Notes (收集火种) | Note editing, follow-capture session import & replay |
| `/graph` | Knowledge Graph (万帷网) | Knowledge-point association & semantic search |
| `/quiz` | Quiz | AI-generated self-testing |
| `/review` | Immersive Review | Review mode |
| `/assistant` | AI Tutor | Contextual Q&A & explanations |
| `/heirs` | Blacktide Erosion (黑潮侵蚀) | Golden-Age heirs card skin effect showcase |
| `/settings` | Settings | AI models, voice, appearance |
| `/logs` | Logs | Developer diagnostics |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Renderer | Vue 3 + TypeScript + Vite |
| Desktop shell | Electron (main process `main.cjs` loads source directly — main-process edits take effect on restart, no rebuild needed) |
| Note rendering | Markdown (marked) + KaTeX |
| Local LLMs | Ollama: moondream / qwen2.5 / nomic-embed-text |
| Speech-to-text | Python + faster-whisper (bundled `transcribe.py`) |
| Text-to-speech | Windows SAPI |
| Storage | Local JSON + image/video files under `app/data` |

---

## Directory Structure

```
.
├─ app/                      # Electron application
│  ├─ electron/              #   Main process main.cjs, IPC, floating bubble bubble.html,
│  │                         #   follow-capture orchestrator, recording proxy, AI calls (callAI.cjs)
│  ├─ src/                   #   Vue 3 renderer (views / components / store / utils)
│  │  └─ data/               #   Theme & character data (e.g. heirs.ts)
│  ├─ public/heirs/          #   Golden-Age heirs artwork assets
│  ├─ vendor/                #   Bundled runtimes (python / ffmpeg / whisper models — packaging only, not committed)
│  ├─ data/ · logs/          #   Runtime data & logs (not committed)
│  └─ package.json
├─ build/                    # Build resources (icons, portable launcher sources, etc.)
├─ docs/                     # Architecture & technical docs
├─ *.md                      # Design / implementation / test plans (per milestone)
└─ 启动*.bat                 # Windows one-click launcher scripts
```

> Runtime directories such as `data / logs / vendor / Ollama / .workbuddy` are excluded via `.gitignore` — a fresh clone is clean source only.

---

## Requirements

- **Windows 10/11 64-bit** (floating bubble, screen recording and the voice loop rely on Windows capabilities)
- **Node.js ≥ 18** (development & build)
- **(Optional) Ollama**: without it, AI features are disabled; everything else (notes, review, bubble recording producing screenshot-only entries) still works
- **(Optional) Python + faster-whisper + ffmpeg**: needed for follow-capture audio transcription; already bundled in the portable release, self-provision for dev setups

---

## Quick Start

```bash
# 1) Install dependencies
cd app
npm install

# 2) Production run (build the renderer first)
npm run build
npm start

# 3) Development mode (hot reload)
npm run electron:dev        # Vite dev server + Electron main process
# or renderer-only preview: npm run dev
```

First-run suggestions:
1. Open **Settings**; if Ollama is installed, configure/confirm the local models (see below);
2. Click **"Record notes"** on the floating bubble to start your first follow-capture session (the system will ask for screen-recording permission);
3. When you stop, the auto-generated follow-capture note (with `🎥` timeline entries and screenshots) is waiting in the **Notes** page.

---

## Local AI Models (optional but recommended)

Follow-capture recognition, the AI tutor and knowledge association rely on a local Ollama. Prepare the models yourself:

```bash
ollama pull moondream            # Vision: understanding follow-capture frames
ollama pull qwen2.5:7b-instruct  # Text: translation / Q&A / summary / quizzes / weekly reports
ollama pull nomic-embed-text     # Embeddings: cross-course retrieval & knowledge graph
```

Pick models and toggle capabilities in **Settings → AI config**. If a model is unavailable, follow-capture entries gracefully degrade to "screenshot saved" placeholders and recording never blocks.

---

## Data & Privacy

- All notes, screenshots and recording sessions are **local files** (default under `app/data`), JSON text storage with images archived per session
- AI requests go only to local Ollama (`127.0.0.1`) — **nothing is ever uploaded to the cloud**
- Full wipe: quit the app and delete the `app/data` directory (back up notes/videos you need first)

---

## Visual System (summary)

- **Palette**: pink `#FF6B9D` / purple `#B794F6` / blue `#4292F5` primary hues with gold accents (Amphoreus)
- **Layout**: rounded cards (12px / 8px), pill buttons, Bento layout
- **Motion**: inline SVG + CSS animation (rotating gear logo, icon glows, breathing halos) — no external assets
- **Skinning showcase**: the `/heirs` Blacktide Erosion page — ink crack lines, black flames rising with erosion level, gold-red sacred flames / embers trading off against erosion, all real-time CSS/SVG

Design tokens and palette conventions live across the per-milestone design docs (root `*.md`) as a reference for re-skinning.

---

## Roadmap

- More theme skins and a finer-grained design-token system
- macOS / Linux support (recording & speech are Windows-specific and need per-platform implementations)
- Note templates & share-card generation
- Optional cloud sync (opt-in, off by default, preserving local-first)

---

## Author

Developed and maintained by **星萌Y小郭酱 (Xingmeng Y Xiaoguo Jiang)**, a content creator on Bilibili (uid 12644772).

- 📺 **Bilibili space**: [星萌Y小郭酱](https://space.bilibili.com/12644772)
  — shares anime-related content, Blender NPR (three-render-two) work, and indie-dev walkthroughs (e.g. "building a local virtual AI desktop companion as a one-person full-stack dev")
- ✍️ Philosophy: making learning tools that are both *anime-aesthetic* and *local-first*; also produces AE / Maya / Blender tutorials and MAD videos

If this project helps you, feel free to star the repo, open an issue, or say hi on Bilibili.

---

## License

This project is released under the **[MIT License](LICENSE)**. You are free to use, modify and redistribute it — please retain the copyright and license notice.

**Attribution for use & derivative works**: if you reference this project (its code, design or any part of it) or build derivative works / redistribute it, please **credit this repository** (link the repo and acknowledge the author above). Also note that **this repository is updated from time to time** — it is under active iteration (fixes and new features), so please keep an eye on the upstream for the latest version when referencing or building upon it. Third-party dependencies follow their own respective licenses (see `app/package.json` and the bundled licenses under `app/vendor/`).
