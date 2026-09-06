#!/usr/bin/env python3
"""NoteStar 常驻语音转写服务（解决每次转写重复加载大模型导致内存崩溃的问题）。

协议：stdin 逐行读取 JSON {"audio": "<音频文件路径>"}，stdout 逐行输出 JSON 结果。
模型只加载一次，所有转写请求复用同一模型，严格串行处理。
"""
import sys
import json
import os

# 强制 stdout/stderr 使用 UTF-8：Windows 下 python 管道输出默认可能是 GBK，
# 主进程按 UTF-8 解码会导致中文乱码（2026-08-14 修复）
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

def resolve_model_dir():
    env_dir = os.environ.get("NOTESTAR_WHISPER_MODEL_DIR", "")
    if env_dir and os.path.isdir(env_dir):
        return env_dir
    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "vendor", "whisper-models"),
        os.path.join(os.path.expanduser("~"), ".cache", "huggingface"),
    ]
    for c in candidates:
        if os.path.isdir(c):
            return c
    return None

def main():
    # 环境变量必须在 import faster_whisper 之前设置
    model_dir = resolve_model_dir()
    if model_dir:
        os.environ["HF_HOME"] = model_dir
        os.environ["HF_HUB_OFFLINE"] = "1"

    from faster_whisper import WhisperModel

    # 直接定位本地 snapshot 目录（绕过 huggingface_hub 缓存解析）
    # 模型优先级：small（低配推荐）> medium > tiny；可用 NOTESTAR_WHISPER_MODEL_SIZE 指定
    hub = os.path.join(model_dir or "", "hub")
    model_path = None
    model_name = None
    preferred = os.environ.get("NOTESTAR_WHISPER_MODEL_SIZE", "small")
    order = [f"Systran/faster-whisper-{preferred}", "Systran/faster-whisper-small", "Systran/faster-whisper-medium", "Systran/faster-whisper-tiny"]
    for repo_id in order:
        repo_dir = os.path.join(hub, "models--" + repo_id.replace("/", "--"))
        snaps = os.path.join(repo_dir, "snapshots")
        if os.path.isdir(snaps):
            snap_list = [d for d in os.listdir(snaps) if os.path.isdir(os.path.join(snaps, d))]
            if snap_list:
                model_path = os.path.join(snaps, snap_list[0])
                model_name = repo_id
                break
    if not model_path:
        model_path = "base"

    # 先加载模型，成功后再报 ready（ready = 模型就绪，可处理请求）
    try:
        model = WhisperModel(model_path, device="cpu", compute_type="int8")
    except Exception as e:
        print(json.dumps({"error": "模型加载失败: " + str(e)}, ensure_ascii=False), flush=True)
        sys.exit(1)

    print(json.dumps({"ready": True, "model": model_name or model_path}, ensure_ascii=False), flush=True)

    # 事件循环：逐行读请求，串行转写
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            audio_path = req.get("audio", "")
            if not audio_path or not os.path.isfile(audio_path):
                print(json.dumps({"error": "音频文件不存在: " + str(audio_path)}, ensure_ascii=False), flush=True)
                continue
            segments, info = model.transcribe(
                audio_path,
                language="zh",
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
            )
            text_parts = []
            for segment in segments:
                text_parts.append(segment.text.strip())
            full_text = "".join(text_parts)
            print(json.dumps({
                "text": full_text,
                "language": info.language if hasattr(info, "language") else "zh",
                "duration": round(info.duration, 1) if hasattr(info, "duration") else 0,
                "model": model_name or model_path,
            }, ensure_ascii=False), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
