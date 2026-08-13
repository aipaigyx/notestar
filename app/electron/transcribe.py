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
        from faster_whisper import WhisperModel

        # 离线加载：模型目录下 hub 缓存中优先 medium（中文效果好），否则 tiny
        model_dir = resolve_model_dir()
        if model_dir:
            os.environ["HF_HOME"] = model_dir
            os.environ["HF_HUB_OFFLINE"] = "1"
        hub = os.path.join(model_dir or "", "hub")
        if model_dir and os.path.isdir(os.path.join(hub, "models--Systran--faster-whisper-medium")):
            model_size = "Systran/faster-whisper-medium"
        elif model_dir and os.path.isdir(os.path.join(hub, "models--Systran--faster-whisper-tiny")):
            model_size = "Systran/faster-whisper-tiny"
        else:
            model_size = "base"  # 无本地模型时退回联网下载（需网络）

        model = WhisperModel(model_size, device="cpu", compute_type="int8")

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
