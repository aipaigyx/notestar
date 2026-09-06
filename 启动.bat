@echo off
chcp 65001 >nul 2>&1
title 笔记星图 - 一键启动（开发模式 · 热重载）
cd /d "%~dp0app"

REM 防止系统环境变量将 Electron 误设为 Node 模式，导致窗口无法创建
set "ELECTRON_RUN_AS_NODE="
set "NODE_OPTIONS="

echo ╔══════════════════════════════════════════╗
echo ║     笔记星图 - 一键启动（开发模式）      ║
echo ║  代码保存即刷新，用于日常开发 / 调试      ║
echo ╚══════════════════════════════════════════╝
echo.

REM ===== 1. 检查 Node.js =====
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] 未检测到 Node.js，请先安装 Node.js 16+
    echo         下载地址: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [1/3] Node.js 版本: %NODE_VER%  OK

REM ===== 2. 检查依赖是否安装 =====
if not exist "node_modules" (
    echo [2/3] 首次运行，正在安装依赖...  （约需 3-10 分钟，仅首次）
    call npm install --legacy-peer-deps
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERROR] 依赖安装失败，请检查网络后重试
        echo.
        pause
        exit /b 1
    )
    echo       依赖安装完成  OK
) else (
    echo [2/3] 依赖已安装  OK
)

REM ===== 3. 清理可能残留的 Electron / Vite 进程 =====
echo [3/3] 检查端口与旧进程...
REM 结束残留 Electron 实例（避免双开数据冲突 / 8200 端口 EADDRINUSE）
taskkill /F /IM electron.exe >nul 2>&1
REM 清理残留 Vite 端口
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING" 2^>nul') do (
    echo       清理残留 Vite 端口 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)
REM 清理仍占用 8200（录屏 HTTP）端口的残留进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8200.*LISTENING" 2^>nul') do (
    echo       清理残留录屏服务 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)
REM 等待句柄释放
timeout /t 1 /nobreak >nul 2>&1
echo       环境就绪  OK
echo.
echo ┌──────────────────────────────────────────┐
echo │       笔记星图（开发模式）正在启动       │
echo │  · 首次启动约需 5-15 秒，请耐心等待      │
echo │  · 修改代码保存后页面会自动热重载        │
echo │  · 关闭此窗口 = 关闭应用                 │
echo │  · 需要生产模式请双击"启动-生产模式.bat" │
echo └──────────────────────────────────────────┘
echo.

REM 开发模式：Vite + Electron 同时起，concurrently 负责调度（支持热重载）
call npm run electron:dev

REM 如果命令异常退出（代码错误/端口冲突等），保留窗口给用户看
echo.
echo ══════════════════════════════════════════
echo 应用已关闭 / 启动失败。
echo 如果是意外闪退，请把上方错误信息截图反馈。
echo ══════════════════════════════════════════
echo.
pause
