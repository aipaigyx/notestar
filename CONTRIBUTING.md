# 贡献指南

欢迎 PR！但先看一下这些 (｡•̀ᴗ-)✧

## 环境准备

`ash
cd app
npm install
npm run electron:dev   # 开发模式
`

## 提 PR 之前

1. Fork 仓库，新建分支（eat/xxx 或 ix/xxx）
2. 改完跑一下现有测试：cd app && npm test
3. 提交前检查：**不要把 pp/userdata/、pp/data/、pp/logs/、pp/vendor/、Ollama/ 里的东西推上来**（.gitignore 已经帮你排除了，但确认一下）
4. PR 写清楚改了啥、为啥改

## 代码风格

- 前端 TypeScript，主进程 CommonJS
- Store 按模块拆（core.ts / notes.ts / ai.ts / quiz.ts）
- IPC 常量统一走 electron/ipc-constants.cjs
- **翁法罗斯配色别乱改**（粉 #FF6B9D / 紫 #B794F6 / 蓝 #4292F5 + 金色点缀），主题引擎在 src/themes/

## Bug 报告

用 [Issue 模板](https://github.com/aipaigyx/notestar/issues/new/choose) 里的 Bug Report，尽量给版本号和操作系统。