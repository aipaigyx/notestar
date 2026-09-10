<div align="center">

# 🌌 NoteStar · 笔记星图

### Anime-Styled Online-Course Notes Tool — Record, and AI takes notes for you

**A local-first, fantasy-anime-aesthetic desktop tool for taking & reviewing online-course notes**

</div>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-FF6B9D?style=flat-square&logo=opensourceinitiative)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-4292F5?style=flat-square&logo=windows&logoColor=white)](#requirements)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A518-8CC84B?style=flat-square&logo=nodedotjs&logoColor=white)](#requirements)
[![Vue](https://img.shields.io/badge/Vue-3-42B883?style=flat-square&logo=vue.js&logoColor=white)](#tech-stack)
[![Electron](https://img.shields.io/badge/Electron-30-9EEAF9?style=flat-square&logo=electron&logoColor=white)](#tech-stack)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](#tech-stack)

</div>

<div align="center">

![UI Overview](docs/ui-screenshots/UI-全界面总览.png)

</div>

> **🌐 Language / 语言： [English](README.en.md) · [中文](README.md)**

---

## ✨ Why NoteStar

| | Key Highlights |
|---|---|
| 🎥 | **Auto Follow-Capture** — one-click screen recording; AI recognizes frames every 30s and generates timestamped illustrated notes automatically |
| 🤖 | **Dual AI Modes** — Cloud (DeepSeek / Volcengine) + Local (Ollama), switch anytime, your data stays under your control |
| 🔒 | **Local-First** — notes, screenshots & videos all stored on your own disk; local mode never leaves your machine |
| 🎨 | **Omphalos Anime Aesthetic** — pink-purple-gold palette, Bento cards, inline-SVG animations, fully code-drawn with zero image dependencies |

---

## ⚡ How it works in 60 seconds

1. **Click "Record & take notes" on the floating bubble** → screen-recording permission is requested
2. **Watch your course as usual** → a frame is captured every 30s in the background
3. **AI understands the frame** (cloud or local model) → writes a Chinese description
4. **Live-appended** to the follow-capture note: `🎥 mm:ss` + screenshot + description
5. **Stop recording** → video is saved, session bound, replay every highlight along the timeline
6. **AI Tutor** explains, generates quizzes, and links the knowledge graph

---

## 📖 Table of Contents

- [Screenshots](#-screenshots)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Local AI Models](#-local-ai-models-optional)
- [Data & Privacy](#-data--privacy)
- [Directory Structure](#-directory-structure)
- [Roadmap](#-roadmap)
- [Author](#-author)
- [License](#-license)

---

## 🖼️ Screenshots

<div align="center">

| Dashboard | Notes |
|:---:|:---:|
| ![Dashboard](docs/screenshots/01-dashboard.png) | ![Notes](docs/screenshots/02-notes.png) |
| Study stats · Pomodoro · Review list | Course-note org · Follow-capture list |

| Knowledge Graph | AI Tutor |
|:---:|:---:|
| ![Knowledge Graph](docs/screenshots/03-graph.png) | ![AI Tutor](docs/screenshots/05-assistant.png) |
| 万帷网 · Local-vector association | Contextual Q&A · Explanations |

| Blacktide Erosion Skin | Settings |
|:---:|:---:|
| ![Blacktide Erosion](docs/screenshots/06-heirs.png) | ![Settings](docs/screenshots/07-settings.png) |
| Ink erosion · Gold-red flames · Embers | AI · Voice · Appearance · Recording |

</div>

---

## 🚀 Features

### 🎨 Visuals & Aesthetics
- Fantasy anime UI (Omphalos theme): pink `#FF6B9D` / purple `#B794F6` / blue `#4292F5` + gold accents
- Bento card layout, rounded pill buttons, soft glows
- Inline-SVG animated logo & nav icons, **fully code-drawn, no image assets**
- "Blacktide Erosion" skin page (`/heirs`): real-time CSS/SVG ink devouring, rising black flames, gold-red sacred flames, ember sparks

### 🎥 Follow-Capture Notes (Floating Bubble Recording)
- System-level desktop floating bubble, one-click "Record & take notes"
- Frame every 30s → AI recognition → auto-append `🎥 mm:ss` timestamped entries
- Auto-archive on stop: video segments, duration stats, note binding, timeline replay
- Low-end device optimization: low-res / low-framerate capture by default

### 🤖 Dual AI Modes (Cloud & Local)
- **Cloud**: DeepSeek / Volcengine APIs for chat, summarization, quizzes
- **Local**: Ollama (moondream vision / qwen2.5 text / nomic embeddings), all on-device
- Switch modes anytime, data stays under your control

### 📝 Note Organization & Structuring
- Course → Note two-level organization, Markdown editing (KaTeX math rendering)
- AI enhancement: summarization, expansion, mind-map, auto-titling
- Export to HTML for sharing & archiving

### 🕸️ Knowledge Network
- Course / note / knowledge-point graph visualization (万帷网)
- Local-vector semantic retrieval across courses

### 🔁 Review Loop
- AI quiz generation, immersive review mode, due-review reminders (hourly)
- AI tutor conversation grounded in the current note context

### 🎙️ Voice Loop
- Local transcription of follow-capture / course audio (faster-whisper + ffmpeg)
- Windows SAPI text-to-speech for listening-based review

### 📊 Statistics & Weekly Reports
- Dashboard: study time, note counts, review progress, weekly reports

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Renderer | Vue 3 + TypeScript + Vite |
| Desktop shell | Electron (main process loads source directly, edits take effect on restart) |
| Note rendering | Markdown (marked) + KaTeX |
| Cloud AI | DeepSeek API / Volcengine (bring your own key) |
| Local AI | Ollama: moondream / qwen2.5 / nomic-embed-text |
| Speech-to-text | Python + faster-whisper (bundled runtime) |
| Text-to-speech | Windows SAPI |
| Storage | Local JSON + image/video files |

---

## ⚙️ Requirements

- **Windows 10/11 64-bit** (floating bubble, recording & voice loop rely on Windows)
- **Node.js ≥ 18** (development & build)
- **(Optional) Ollama** — without it, use cloud mode; all other features still work
- **(Optional) Python + faster-whisper + ffmpeg** — for audio transcription; bundled in portable release

---

## 🚀 Quick Start

```bash
# 1) Install dependencies
cd app
npm install

# 2) Production run
npm run build
npm start

# 3) Development mode (hot reload)
npm run electron:dev        # Vite + Electron main process
```

**First run**:
1. Open **Settings** to configure your AI platform (cloud API key or local Ollama)
2. Click **"Record & take notes"** on the floating bubble to start your first session
3. Stop and check **Notes** for the auto-generated follow-capture note

---

## 🧠 Local AI Models (optional)

```bash
ollama pull moondream            # Vision: follow-capture frame understanding
ollama pull qwen2.5:7b-instruct  # Text: translation / Q&A / summary / quizzes / weekly reports
ollama pull nomic-embed-text     # Embeddings: cross-course retrieval & knowledge graph
```

Toggle cloud/local mode in **Settings → AI config**. If a model is unavailable, follow-capture entries gracefully degrade to "screenshot saved" and recording never blocks.

---

## 🔒 Data & Privacy

- All notes, screenshots & recordings are **local files** (default `app/data`), JSON text storage
- Dual AI modes: cloud uses DeepSeek / Volcengine APIs (bring your own key); local uses Ollama — **data never leaves your machine**
- Full wipe: quit the app and delete the `app/data` directory (back up first)

---

## 📂 Directory Structure

```
.
├─ app/                      # Electron application
│  ├─ electron/              #   Main process, IPC, floating bubble, follow-capture, AI calls
│  ├─ src/                   #   Vue 3 renderer (views / components / store / utils)
│  ├─ public/heirs/          #   Golden-Age heirs artwork assets
│  └─ package.json
├─ build/                    # Build resources (icons, portable launcher, etc.)
├─ docs/                     # Architecture & technical docs
└─ *.bat                     # Windows one-click launcher scripts
```

> Runtime directories (`data / logs / vendor / Ollama`) are excluded via `.gitignore`.

---

## 🗺️ Roadmap

- More theme skins & a finer-grained design-token system
- macOS / Linux support (recording & speech are Windows-specific)
- Note templates & share-card generation
- Optional cloud sync (opt-in, off by default, preserving local-first)

---

## 👤 Author

Developed and maintained by **星萌Y小郭酱 (Xingmeng Y Xiaoguo Jiang)**, a content creator on Bilibili (uid 12644772).

- 📺 **Bilibili**: [星萌Y小郭酱](https://space.bilibili.com/12644772) — anime / Blender NPR / indie-dev content
- ✍️ Philosophy: making learning tools that are both *anime-aesthetic* and *local-first*

Feel free to star the repo, open an issue, or say hi on Bilibili 🌟

---

## 📄 License

Released under the **[MIT License](LICENSE)**.

> When referencing or building derivative works, please credit this repository (link the repo and acknowledge the author). This repo is actively iterated — please sync with upstream for the latest version. Third-party dependencies follow their own licenses.
