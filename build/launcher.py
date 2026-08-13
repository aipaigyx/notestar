# -*- coding: utf-8 -*-
# 笔记星图 便携版启动器
# 双击运行：定位 app/node_modules/electron/dist/electron.exe，加载 app 目录启动应用
# 打包: python -m PyInstaller --onefile --noconsole --name NoteStarLauncher launcher.py
import os
import sys
import subprocess
import ctypes


def msgbox(text, title="笔记星图", error=False):
    MB_OK = 0x0
    MB_ICONERROR = 0x10
    MB_ICONINFORMATION = 0x40
    flags = MB_OK | (MB_ICONERROR if error else MB_ICONINFORMATION)
    try:
        ctypes.windll.user32.MessageBoxW(0, text, title, flags)
    except Exception:
        pass


def main():
    if getattr(sys, "frozen", False):
        root = os.path.dirname(os.path.abspath(sys.executable))
    else:
        root = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.join(root, "app")
    electron = os.path.join(app_dir, "node_modules", "electron", "dist", "electron.exe")

    if not os.path.isfile(electron):
        msgbox("未找到 Electron 运行环境。\n请确认文件存在：\n" + electron, error=True)
        return
    if not os.path.isdir(os.path.join(app_dir, "dist")):
        msgbox("未找到前端构建产物（app/dist），请先执行构建后再启动。", error=True)
        return

    env = dict(os.environ)
    env.pop("ELECTRON_RUN_AS_NODE", None)
    env.pop("NODE_OPTIONS", None)
    env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true"

    try:
        proc = subprocess.Popen([electron, app_dir], cwd=app_dir, env=env)
        proc.wait()
    except Exception as e:
        msgbox("启动失败：" + str(e), error=True)


if __name__ == "__main__":
    main()
