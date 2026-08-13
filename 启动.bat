@echo off
chcp 65001 >nul 2>&1
title 笔记星图 - 一键启动
cd /d "%~dp0app"

REM 防止系统环境变量将 Electron 误设为 Node 模式，导致窗口无法创建
set "ELECTRON_RUN_AS_NODE="
set "NODE_OPTIONS="

echo ╔══════════════════════════════════════════╗
echo ║          笔记星图 - 一键启动脚本          ║
echo ╚══════════════════════════════════════════╝
echo.

REM ===== 1. 检查 Node.js =====
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] 未检测到 Node.js，请先安装 Node.js 16+ 
    echo         下载地址: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [1/4] Node.js 版本: %NODE_VER%  OK

REM ===== 2. 检查依赖是否安装 =====
if not exist "node_modules" (
    echo [2/4] 首次运行，正在安装依赖...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] 依赖安装失败，请检查网络后重试
        pause
        exit /b 1
    )
    echo       依赖安装完成
) else (
    echo [2/4] 依赖已安装  OK
)

REM ===== 3. 清理可能残留的 5173 端口 =====
echo [3/4] 检查端口占用...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING" 2^>nul') do (
    echo       清理残留进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)
echo       端口就绪  OK

REM ===== 4. 构建生产版本 =====
echo [4/4] 构建生产版本...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] 构建失败，请检查代码
    pause
    exit /b 1
)
echo       构建完成，启动应用...
echo.
echo ┌──────────────────────────────────────────┐
echo │          笔记星图 - 正在启动              │
echo │  首次启动约需 5-10 秒，请耐心等待         │
echo │  按 Ctrl+C 可关闭应用                     │
echo └──────────────────────────────────────────┘
echo.

call npm start

echo.
echo 应用已关闭。
pause
