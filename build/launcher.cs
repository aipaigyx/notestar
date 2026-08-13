// 笔记星图 便携版启动器
// 双击本 exe：定位 app/node_modules/electron/dist/electron.exe，加载 app 目录启动应用
// 编译: csc /nologo /target:winexe /codepage:65001 /out:笔记星图.exe launcher.cs
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace NoteStarLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            string root = Path.GetDirectoryName(Application.ExecutablePath);
            if (string.IsNullOrEmpty(root)) root = Directory.GetCurrentDirectory();
            string appDir = Path.Combine(root, "app");
            string electron = Path.Combine(appDir, "node_modules", "electron", "dist", "electron.exe");

            if (!File.Exists(electron))
            {
                MessageBox.Show(
                    "未找到 Electron 运行环境。\n请确认以下文件存在：\n" + electron,
                    "笔记星图", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            if (!Directory.Exists(Path.Combine(appDir, "dist")))
            {
                MessageBox.Show(
                    "未找到前端构建产物（app/dist），请先执行构建后再启动。",
                    "笔记星图", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            var psi = new ProcessStartInfo(electron, "\"" + appDir + "\"");
            psi.WorkingDirectory = appDir;
            psi.UseShellExecute = false;
            // 防止系统环境变量干扰 Electron 图形模式
            psi.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
            psi.EnvironmentVariables.Remove("NODE_OPTIONS");
            psi.EnvironmentVariables["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";

            try
            {
                using (Process p = Process.Start(psi))
                {
                    if (p != null)
                    {
                        p.WaitForExit();
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("启动失败：" + ex.Message, "笔记星图",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
