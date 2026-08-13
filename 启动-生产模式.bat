@echo off
chcp 65001 >nul 2>&1
title 笔记星图 - 生产模式启动
cd /d "%~dp0app"

REM 防止系统环境变量将 Electron 误设为 Node 模式，导致窗口无法创建
set "ELECTRON_RUN_AS_NODE="
set "NODE_OPTIONS="

echo ╔══════════════════════════════════════════╗
echo ║      笔记星图 - 生产模式启动脚本          ║
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
echo [1/3] Node.js 版本: %NODE_VER%  OK

REM ===== 2. 检查依赖 =====
if not exist "node_modules" (
    echo [2/3] 首次运行，正在安装依赖...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [2/3] 依赖已安装  OK
)

REM ===== 3. 构建 + 启动 =====
echo [3/3] 构建生产版本...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] 构建失败，请检查代码
    pause
    exit /b 1
)
echo       构建完成，启动应用...
echo.

call npm start

echo.
echo 应用已关闭。
pause
