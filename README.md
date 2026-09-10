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
[![Bilibili](https://img.shields.io/badge/B站-星萌Y小郭酱-FF69B4?style=flat-square&logo=bilibili&logoColor=white)](https://space.bilibili.com/12644772)

</div>

> **👤 作者**：[星萌Y小郭酱](https://space.bilibili.com/12644772) · B 站 UP 主 · 二次元 / Blender 三渲二 / 独立开发
>
> **🌐 Language / 语言： [中文](README.md) · [English](README.en.md)**

---

## 🎭 这是什么？

上网课手忙脚乱记笔记？笔记翻完就忘？复习像开荒没地图？

**笔记星图** 是为你打造的——一款能 **录屏自动跟拍成笔记** 的二次元桌面工具。

你只管上课，剩下的交给它：悬浮球一键开录，AI 每隔一会儿截一帧画面、看懂你在学什么，然后把重点按时间轴整理成笔记。下课直接复习，再也不用对着录屏从头拖进度条了 (｡•̀ᴗ-)✧

---

## ⚡ 60 秒看懂怎么用

1. 点一下桌面上的 **悬浮球**，选「录屏笔记」
2. 该上课上课，该摸鱼摸鱼，它在后台默默截帧 + AI 识别
3. 每条识别结果会带着 `🎥 时间码 + 截图 + 描述` 自动追加到笔记里
4. 下课停止录屏 → 视频和笔记自动绑定 → 笔记页按时间轴回看重点
5. 想复习了？AI 助教基于你的笔记出题、讲解、关联知识图谱

> 整个过程数据都在你自己电脑上，本地模式下连网都不用连。

---

## 🖼️ 截图展示

<div align="center">

| 仪表盘 | 笔记整理 |
|:---:|:---:|
| ![仪表盘](docs/screenshots/01-dashboard.png) | ![笔记整理](docs/screenshots/02-notes.png) |
| 学习统计 · 番茄专注 · 复习清单 | 课程-笔记两级 · 跟拍列表 |

| 知识图谱 | AI 助教 |
|:---:|:---:|
| ![知识图谱](docs/screenshots/03-graph.png) | ![AI 助教](docs/screenshots/05-assistant.png) |
| 万帷网 · 知识点自动关联 | 上下文问答 · 讲解 |

| 黑潮侵蚀皮肤 | 设置 |
|:---:|:---:|
| ![黑潮侵蚀](docs/screenshots/06-heirs.png) | ![设置](docs/screenshots/07-settings.png) |
| 墨色侵蚀 · 金红圣火 · 余烬火星 | AI · 语音 · 外观 · 录屏 |

</div>

---

## ✨ 灵魂特性

### 🎥 跟拍笔记
系统级桌面悬浮球，随时一键录屏。AI 每 30 秒自动截帧识别画面，带时间轴的图文笔记实时生成，下课就能直接复习。低性能电脑也能流畅跑。

### 🤖 AI 双模式
- **云端**：DeepSeek / 火山引擎 API，开箱即用
- **本地**：Ollama（moondream 看画面 + qwen2.5 聊天 + nomic 向量），数据不出本机
两种模式随时切换，想用哪个用哪个。

### 🔒 数据自主
笔记、截图、录屏全部存在你自己的硬盘里，本地模式下数据绝不出本机。

### 🎨 翁法罗斯美学
粉 `#FF6B9D` / 紫 `#B794F6` / 蓝 `#4292F5` + 金色点缀，Bento 卡片布局，内联 SVG 动态 Logo 和导航图标——**全套代码绘制，零图片依赖**，连图标都会呼吸。还有「黑潮侵蚀」皮肤页，墨色吞噬、黑火窜高、金红圣火，全是 CSS/SVG 实时演的。

### 🕸️ 万帷网（知识图谱）
学过的知识点会自动关联成一张网，跨课程也能搜到相关内容。复习不再是大海捞针，而是顺着脉络一路打通。

### 🔁 复习闭环
AI 自动出题、沉浸式复习模式、到期提醒（每小时检查一次）。学完就复习，复习完就记住。

### 🎙️ 语音闭环
跟拍音频可以本地转写（faster-whisper），也能让 Windows 语音朗读给你听——走路也能复习。

### 📊 学习仪表盘
学习时长、笔记数量、复习进度、每周报告……数据可视化，让努力看得见。

---

## 🚀 快速开始

```bash
# 安装依赖
cd app
npm install

# 生产模式运行
npm run build
npm start

# 开发模式（热更新）
npm run electron:dev
```

> Windows 用户也可以直接双击根目录的 `启动.bat` 一键启动。

**首次使用**：进「设置」配一下 AI（云端填 Key，本地装 Ollama），然后点悬浮球开录，剩下的交给它 (๑•̀ㅂ•́)و✧

---

## 🧠 本地 AI 模型（可选）

想用本地模式的话，自己拉模型：

```bash
ollama pull moondream            # 视觉：看懂跟拍画面
ollama pull qwen2.5:7b-instruct  # 文本：聊天 / 摘要 / 出题 / 周报
ollama pull nomic-embed-text     # 向量：知识图谱关联
```

没模型也不慌——跟拍会自动降级成「截图存档」，录屏照录不误，之后有模型了再识别也行。

---

## 🛠️ 技术栈

| 层 | 选型 |
|---|---|
| 渲染层 | Vue 3 + TypeScript + Vite |
| 桌面壳 | Electron（主进程直载源码，改完即生效） |
| 笔记渲染 | Markdown + KaTeX（公式支持） |
| 云端 AI | DeepSeek / 火山引擎 |
| 本地 AI | Ollama：moondream / qwen2.5 / nomic |
| 语音转写 | Python + faster-whisper |
| 语音合成 | Windows SAPI |
| 存储 | 本地 JSON + 图片/视频文件 |

---

## ⚙️ 环境要求

- **Windows 10/11 64 位**（悬浮球、录屏、语音依赖 Windows）
- **Node.js ≥ 18**
- **（可选）Ollama** — 不装就用云端模式
- **（可选）Python + ffmpeg** — 音频转写用，便携版已内置

---

## 📂 目录结构

```
.
├─ app/          # Electron 应用主体
│  ├─ electron/  #   主进程、IPC、悬浮球、跟拍编排、AI 调用
│  ├─ src/       #   Vue 3 渲染层（views / components / store）
│  └─ public/    #   静态资源
├─ build/        # 构建资源（图标、启动器等）
├─ docs/         # 截图资源
└─ 启动*.bat     # Windows 一键启动脚本
```

> `data / logs / vendor / Ollama / 技术文档` 等运行时与内部目录已在 `.gitignore` 中排除。

---

## 🗺️ Roadmap

- 🎨 更多主题皮肤（皮肤才是本体！）
- 🍎 macOS / Linux 适配
- 📝 笔记模板 & 分享卡片生成
- ☁️ 云端同步（可选、默认关闭，保持本地优先）

---

## 👤 作者

B 站 UP 主 **星萌Y小郭酱**（uid 12644772）

📺 [哔哩哔哩空间](https://space.bilibili.com/12644772) — 二次元 / Blender 三渲二 / 独立开发

觉得这个项目对你有帮助的话，欢迎 Star ⭐ 或者来 B 站找我玩呀~

---

## 💭 为什么做这个？

做笔记星图，是因为我相信一件事：**AI 是辅助学习的工具，但不能代替你学习。**

AI 迭代很快，会的东西越来越多。但 AI 会的，不代表你会。

所以这个软件的定位从来不是「让 AI 帮你把课学了」，而是帮你把**记录、整理、复习**这些琐碎又耗时的环节自动化，让你把省下来的时间和精力，真正用在**理解和思考**上。

跟拍帮你不漏掉重点，图谱帮你串起知识，出题帮你检验掌握——但最终坐在屏幕前、把知识变成自己的，还是你自己。

愿这个工具能陪你走得更远一点 ✨

---

## 📄 License

本项目基于 **[MIT License](LICENSE)** 开源。二次开发请注明出处，第三方依赖遵循各自许可证。
