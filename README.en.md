<div align="center">

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

</div>

> **🌐 Language / 语言： [English](README.en.md) · [中文](README.md)**

---

## 🎭 What is this?

Scrambling to take notes during class? Forgetting everything right after? Reviewing with no map?

**NoteStar** is built for you — an anime-styled desktop tool that **auto-captures your screen into notes**.

The rest... download and find out yourself ~(｡･ω･｡)ﾉ♡

---

## 🖼️ Screenshots

<div align="center">

| Dashboard | Notes |
|:---:|:---:|
| ![Dashboard](docs/screenshots/01-dashboard.png) | ![Notes](docs/screenshots/02-notes.png) |

| Knowledge Graph | AI Tutor |
|:---:|:---:|
| ![Knowledge Graph](docs/screenshots/03-graph.png) | ![AI Tutor](docs/screenshots/05-assistant.png) |

| Blacktide Erosion Skin | Settings |
|:---:|:---:|
| ![Blacktide Erosion](docs/screenshots/06-heirs.png) | ![Settings](docs/screenshots/07-settings.png) |

</div>

---

## ✨ Soul Features

🎥 **Follow-Capture Notes** — one-click screen recording, AI captures & recognizes a frame every 30s, timestamped illustrated notes generated automatically. Review right after class.

🤖 **Dual AI Modes** — Cloud (DeepSeek / Volcengine) + Local (Ollama). Online or offline, your call.

🔒 **Your Data, Your Rules** — notes, screenshots & videos all on your disk. Local mode never leaves your machine.

🎨 **Omphalos Aesthetic** — pink-purple-gold palette, Bento cards, inline-SVG animations. Fully code-drawn, even the icons breathe.

🕸️ **Knowledge Web (万帷网)** — knowledge points auto-linked into a graph, cross-course semantic search. No more needle-in-a-haystack review.

🔁 **Review Loop** — AI quizzes, immersive review, due reminders. Learn it, keep it.

---

## ⚡ Quick Start

```bash
cd app
npm install
npm run build
npm start
```

> Dev mode with hot reload: `npm run electron:dev`

First run: open **Settings**, configure AI, hit the floating bubble to record, and let it do the rest (๑•̀ㅂ•́)و✧

---

## 🧠 Local AI (optional)

```bash
ollama pull moondream            # Vision: understand frames
ollama pull qwen2.5:7b-instruct  # Text: chat / summary / quizzes
ollama pull nomic-embed-text     # Embeddings: knowledge links
```

No model? No problem — follow-capture gracefully degrades to screenshot-only, recording never blocks.

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Renderer | Vue 3 + TypeScript + Vite |
| Desktop shell | Electron |
| Note rendering | Markdown + KaTeX |
| AI | DeepSeek / Volcengine / Ollama |
| Voice | faster-whisper + Windows SAPI |
| Storage | Local JSON + media files |

---

## ⚙️ Requirements

- Windows 10/11 64-bit
- Node.js ≥ 18
- Ollama / Python + ffmpeg (optional, most features work without)

---

## 📂 Directory Structure

```
.
├─ app/          # Electron application
│  ├─ electron/  #   Main process, IPC, bubble, follow-capture, AI
│  └─ src/       #   Vue 3 renderer
├─ docs/         # Technical docs
└─ *.bat         # Windows launchers
```

---

## 🗺️ Roadmap

- More theme skins (skins are the real deal!)
- macOS / Linux support
- Note templates & share cards
- Cloud sync (off by default, local-first)

---

## 👤 Author

**星萌Y小郭酱 (Xingmeng Y Xiaoguo Jiang)**, Bilibili creator (uid 12644772)

📺 [Bilibili Space](https://space.bilibili.com/12644772) · Anime / Blender NPR / indie dev

Star the repo or say hi on Bilibili 🌟

---

## 📄 License

[MIT License](LICENSE) · Please credit the source for derivative works
