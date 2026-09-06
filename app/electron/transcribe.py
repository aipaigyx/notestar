#!/usr/bin/env python3
"""Local Whisper transcription script for NoteStar.
Reads an audio file path from argv[1], transcribes it, and prints JSON result.
模型从本地目录加载（NOTESTAR_WHISPER_MODEL_DIR 指定，离线可用），
不依赖联网下载；打包后随应用一起分发。
"""
import sys
import json
import os

def resolve_model_dir():
    """返回本地模型缓存目录（HF_HOME 根），找不到时返回 None"""
    env_dir = os.environ.get("NOTESTAR_WHISPER_MODEL_DIR", "")
    if env_dir and os.path.isdir(env_dir):
        return env_dir
    # 兜底：常见位置
    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "vendor", "whisper-models"),
        os.path.join(os.path.expanduser("~"), ".cache", "huggingface"),
    ]
    for c in candidates:
        if os.path.isdir(c):
            return c
    return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No audio file path provided"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    if not os.path.isfile(audio_path):
        print(json.dumps({"error": f"File not found: {audio_path}"}))
        sys.exit(1)

    try:
        # 必须在 import faster_whisper 之前设置 HF_HOME/HF_HUB_OFFLINE——
        # huggingface_hub 在 import 时读取环境变量，之后设置无效，
        # 会导致仍去默认 ~/.cache/huggingface 找模型而报
        # "Cannot find an appropriate cached snapshot folder"（2026-08-14 修复）。
        model_dir = resolve_model_dir()
        if model_dir:
            os.environ["HF_HOME"] = model_dir
            os.environ["HF_HUB_OFFLINE"] = "1"
        from faster_whisper import WhisperModel

        # 优先直接定位本地 snapshot 目录并传目录路径给 WhisperModel——
        # faster-whisper 支持直接加载 ctranslate2 模型目录，彻底绕开 huggingface_hub
        # 缓存解析（HF 缓存解析在此环境不可靠，会报 LocalEntryNotFoundError）。
        hub = os.path.join(model_dir or "", "hub")
        model_size = None
        model_path = None
        for repo in ("models--Systran--faster-whisper-medium", "models--Systran--faster-whisper-tiny"):
            repo_dir = os.path.join(hub, repo)
            snaps = os.path.join(repo_dir, "snapshots")
            if os.path.isdir(snaps):
                snap_list = [d for d in os.listdir(snaps) if os.path.isdir(os.path.join(snaps, d))]
                if snap_list:
                    model_path = os.path.join(snaps, snap_list[0])
                    model_size = "Systran/faster-whisper-" + ("medium" if "medium" in repo else "tiny")
                    break
        if not model_path:
            model_size = "base"  # 无本地模型时退回联网下载（需网络）

        model = WhisperModel(model_path or model_size, device="cpu", compute_type="int8")

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
            "language": info.language if hasattr(info, 'language') else "zh",
            "duration": round(info.duration, 1) if hasattr(info, 'duration') else 0,
            "model": model_size,
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
