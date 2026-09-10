<div align="center">

![NoteStar](docs/cover.jpg)

# 🌌 NoteStar · 笔记星图

### Turn online courses into an Omphalos adventure ✨

**Local-first · Anime aesthetic · AI follow-capture notes**

</div>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-FF6B9D?style=flat-square&logo=opensourceinitiative)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-4292F5?style=flat-square&logo=windows&logoColor=white)](#requirements)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A518-8CC84B?style=flat-square&logo=nodedotjs&logoColor=white)](#requirements)
[![Vue](https://img.shields.io/badge/Vue-3-42B883?style=flat-square&logo=vue.js&logoColor=white)](#tech-stack)
[![Electron](https://img.shields.io/badge/Electron-30-9EEAF9?style=flat-square&logo=electron&logoColor=white)](#tech-stack)
[![Bilibili](https://img.shields.io/badge/B站-星萌Y小郭酱-FF69B4?style=flat-square&logo=bilibili&logoColor=white)](https://space.bilibili.com/12644772)

</div>

> **👤 Author**: [星萌Y小郭酱](https://space.bilibili.com/12644772) · Bilibili creator · Anime / Blender NPR / indie dev
>
> **🌐 Language / 语言： [English](README.en.md) · [中文](README.md)**

---

## 🎭 What is this?

Scrambling to take notes during class? Forgetting everything right after? Reviewing with no map?

**NoteStar** is built for you — an anime-styled desktop tool that **auto-captures your screen into notes**.

Just attend class and let it do the rest: one click on the floating bubble to start recording, AI silently captures frames and understands what you're learning, then organizes key points into a timeline-based note. Review right after class — no more scrubbing through recordings from the start (｡•̀ᴗ-)✧

---

## ⚡ How it works in 60 seconds

1. Click the **floating bubble** on your desktop, select "Record & take notes"
2. Attend class (or slack off, your call) — it captures frames + runs AI recognition in the background
3. Each result gets auto-appended as `🎥 timestamp + screenshot + description`
4. Stop recording → video & notes auto-bound → replay highlights along the timeline
5. Time to review? AI tutor generates quizzes, explains, and links the knowledge graph

> All data stays on your machine. In local mode, you don't even need internet.

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
| 万帷网 · Auto knowledge linking | Contextual Q&A · Explanations |

| Blacktide Erosion Skin | Settings |
|:---:|:---:|
| ![Blacktide Erosion](docs/screenshots/06-heirs.png) | ![Settings](docs/screenshots/07-settings.png) |
| Ink erosion · Gold-red flames · Embers | AI · Voice · Appearance · Recording |

</div>

---

## ✨ Soul Features

### 🎥 Follow-Capture Notes
A system-level desktop floating bubble for one-click recording. AI captures & recognizes a frame every 30s, generating timestamped illustrated notes in real time. Works smoothly even on low-end machines.

### 🤖 Dual AI Modes
- **Cloud**: DeepSeek / Volcengine APIs, works out of the box
- **Local**: Ollama (moondream for vision + qwen2.5 for chat + nomic for embeddings), data never leaves your machine
Switch anytime, use whichever you prefer.

### 🔒 Your Data, Your Rules
Notes, screenshots & recordings all live on your disk (default `app/data`). In local mode, AI requests only go to `127.0.0.1` — nothing is uploaded. Want a full wipe? Just delete `app/data`.

### 🎨 Omphalos Aesthetic
Pink `#FF6B9D` / purple `#B794F6` / blue `#4292F6` + gold accents, Bento card layout, inline-SVG animated logo & nav icons — **fully code-drawn, zero image assets**, even the icons breathe. There's also a "Blacktide Erosion" skin page with ink devouring, rising black flames, and gold-red sacred fires — all rendered in real-time CSS/SVG.

### 🕸️ Knowledge Web (万帷网)
Learned knowledge points auto-link into a web, searchable across courses. Review is no longer needle-in-a-haystack — just follow the threads.

### 🔁 Review Loop
AI-generated quizzes, immersive review mode, due reminders (checked hourly). Learn it, review it, keep it.

### 🎙️ Voice Loop
Follow-capture audio can be transcribed locally (faster-whisper), or read aloud via Windows TTS — review even while walking.

### 📊 Study Dashboard
Study time, note counts, review progress, weekly reports... data visualization that makes your effort visible.

---

## 🚀 Quick Start

```bash
# Install dependencies
cd app
npm install

# Production run
npm run build
npm start

# Development mode (hot reload)
npm run electron:dev
```

> Windows users can also double-click `启动.bat` in the root folder to launch with one click.

**First run**: open **Settings**, configure AI (cloud API key or local Ollama), then hit the floating bubble to record. Let it do the rest (๑•̀ㅂ•́)و✧

---

## 🧠 Local AI Models (optional)

If you want local mode, pull the models yourself:

```bash
ollama pull moondream            # Vision: understand follow-capture frames
ollama pull qwen2.5:7b-instruct  # Text: chat / summary / quizzes / weekly reports
ollama pull nomic-embed-text     # Embeddings: knowledge graph linking
```

No model? No problem — follow-capture gracefully degrades to "screenshot saved". Recording never blocks, and you can run recognition later.

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Renderer | Vue 3 + TypeScript + Vite |
| Desktop shell | Electron (main process loads source directly, edits take effect on restart) |
| Note rendering | Markdown + KaTeX (math support) |
| Cloud AI | DeepSeek / Volcengine |
| Local AI | Ollama: moondream / qwen2.5 / nomic |
| Speech-to-text | Python + faster-whisper |
| Text-to-speech | Windows SAPI |
| Storage | Local JSON + image/video files |

---

## ⚙️ Requirements

- **Windows 10/11 64-bit** (floating bubble, recording & voice loop rely on Windows)
- **Node.js ≥ 18**
- **(Optional) Ollama** — without it, use cloud mode
- **(Optional) Python + ffmpeg** — for audio transcription; bundled in portable release

---

## 📂 Directory Structure

```
.
├─ app/          # Electron application
│  ├─ electron/  #   Main process, IPC, bubble, follow-capture, AI calls
│  ├─ src/       #   Vue 3 renderer (views / components / store)
│  └─ public/    #   Static assets
├─ build/        # Build resources (icons, launcher, etc.)
├─ docs/         # Screenshots
└─ *.bat         # Windows launcher scripts
```

> Runtime & internal directories (`data / logs / vendor / Ollama / 技术文档`) are excluded via `.gitignore`.

---

## 🗺️ Roadmap

- 🎨 More theme skins (skins are the real deal!)
- 🍎 macOS / Linux support
- 📝 Note templates & share-card generation
- ☁️ Cloud sync (opt-in, off by default, preserving local-first)

---

## 👤 Author

**星萌Y小郭酱 (Xingmeng Y Xiaoguo Jiang)**, Bilibili creator (uid 12644772)

📺 [Bilibili Space](https://space.bilibili.com/12644772) — Anime / Blender NPR / indie dev

If this project helps you, star the repo ⭐ or come say hi on Bilibili~

---

## 📄 License

Released under the **[MIT License](LICENSE)**. Please credit the source for derivative works. Third-party dependencies follow their own licenses.
