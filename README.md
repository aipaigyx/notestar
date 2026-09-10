<div align="center">

![笔记星图 NoteStar](docs/cover.jpg)

# 🌌 笔记星图 · NoteStar

### 把网课，变成一场翁法罗斯的冒险 ✨

**本地优先 · 二次元美学 · AI 跟拍笔记**

</div>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-FF6B9D?style=flat-square&logo=opensourceinitiative)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-4292F5?style=flat-square&logo=windows&logoColor=white)](#环境要求)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A518-8CC84B?style=flat-square&logo=nodedotjs&logoColor=white)](#环境要求)
[![Vue](https://img.shields.io/badge/Vue-3-42B883?style=flat-square&logo=vue.js&logoColor=white)](#技术栈)
[![Electron](https://img.shields.io/badge/Electron-30-9EEAF9?style=flat-square&logo=electron&logoColor=white)](#技术栈)

</div>

> **🌐 Language / 语言： [中文](README.md) · [English](README.en.md)**

---

## 🎭 这是什么？

上网课手忙脚乱记笔记？笔记翻完就忘？复习像开荒没地图？

**笔记星图** 是为你打造的——一款能 **录屏自动跟拍成笔记** 的二次元桌面工具。

剩下的，自己下下来康康吧~(｡･ω･｡)ﾉ♡

---

## 🖼️ 截图展示

<div align="center">

| 仪表盘 | 笔记整理 |
|:---:|:---:|
| ![仪表盘](docs/screenshots/01-dashboard.png) | ![笔记整理](docs/screenshots/02-notes.png) |

| 知识图谱 | AI 助教 |
|:---:|:---:|
| ![知识图谱](docs/screenshots/03-graph.png) | ![AI 助教](docs/screenshots/05-assistant.png) |

| 黑潮侵蚀皮肤 | 设置 |
|:---:|:---:|
| ![黑潮侵蚀](docs/screenshots/06-heirs.png) | ![设置](docs/screenshots/07-settings.png) |

</div>

---

## ✨ 灵魂特性

🎥 **跟拍笔记** — 悬浮球一键录屏，AI 每 30 秒自动截帧识别，带时间轴的图文笔记自动生成，下课就能直接复习

🤖 **AI 双模式** — 云端（DeepSeek / 火山引擎）+ 本地（Ollama），想联网就联网，想离线就离线，随你

🔒 **数据自主** — 笔记、截图、视频全在你硬盘里，本地模式下数据绝不出本机

🎨 **翁法罗斯美学** — 粉紫金配色、Bento 卡片、内联 SVG 动效，全套代码绘制，连图标都会呼吸

🕸️ **万帷网** — 知识点自动关联成图谱，跨课程语义检索，复习不再大海捞针

🔁 **复习闭环** — AI 出题、沉浸复习、到期提醒，学完就记住

---

## ⚡ 快速开始

```bash
cd app
npm install
npm run build
npm start
```

> 开发模式热更新：`npm run electron:dev`

首次使用进「设置」配一下 AI，然后点悬浮球开录，剩下的交给它 (๑•̀ㅂ•́)و✧

---

## 🧠 本地 AI（可选）

```bash
ollama pull moondream            # 视觉：看懂画面
ollama pull qwen2.5:7b-instruct  # 文本：聊天 / 摘要 / 出题
ollama pull nomic-embed-text     # 向量：知识关联
```

没模型也不慌，跟拍会自动降级成截图存档，录屏照录不误。

---

## 🛠️ 技术栈

| 层 | 选型 |
|---|---|
| 渲染层 | Vue 3 + TypeScript + Vite |
| 桌面壳 | Electron |
| 笔记渲染 | Markdown + KaTeX |
| AI | DeepSeek / 火山引擎 / Ollama |
| 语音 | faster-whisper + Windows SAPI |
| 存储 | 本地 JSON + 媒体文件 |

---

## ⚙️ 环境要求

- Windows 10/11 64 位
- Node.js ≥ 18
- Ollama / Python + ffmpeg（可选，不装也能用大部分功能）

---

## 📂 目录结构

```
.
├─ app/          # Electron 应用主体
│  ├─ electron/  #   主进程、IPC、悬浮球、跟拍、AI
│  └─ src/       #   Vue 3 渲染层
├─ docs/         # 截图资源
└─ 启动*.bat     # Windows 一键启动
```

---

## 🗺️ Roadmap

- 更多主题皮肤（皮肤才是本体！）
- macOS / Linux 适配
- 笔记模板 & 分享卡片
- 云端同步（默认关闭，本地优先）

---

## 👤 作者

B 站 UP 主 **星萌Y小郭酱**（uid 12644772）

📺 [哔哩哔哩空间](https://space.bilibili.com/12644772) · 二次元 / Blender 三渲二 / 独立开发

觉得有用的话，Star 一下或者来 B 站找我玩呀 🌟

---

## 📄 License

[MIT License](LICENSE) · 二次开发请注明出处
