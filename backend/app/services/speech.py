from typing import Any

import httpx

from ..config import get_settings

MAX_AUDIO_BYTES = 10 * 1024 * 1024
ALLOWED_PREFIXES = ("audio/", "video/webm")


class SpeechUnavailable(Exception):
    pass


async def transcribe(
    data: bytes, content_type: str, filename: str = "audio", provider: Any = None
) -> str:
    """Return transcript text only. Gemma 4 is tried first; ElevenLabs is the fallback."""
    s = get_settings()
    mime = (content_type or "audio/webm").split(";", 1)[0].strip() or "audio/webm"
    hear = getattr(provider, "transcribe", None)
    if hear is not None:
        try:
            from .llm import LLMUnavailable

            return str(await hear(data, mime)).strip()
        except LLMUnavailable as e:
            if not s.elevenlabs_api_key:
                raise SpeechUnavailable(str(e)) from e
    if not s.elevenlabs_api_key:
        raise SpeechUnavailable("Voice transcription is not configured")
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                headers={"xi-api-key": s.elevenlabs_api_key},
                data={"model_id": s.elevenlabs_stt_model},
                files={"file": (filename, data, content_type)},
            )
            r.raise_for_status()
            return str(r.json().get("text", "")).strip()
    except (httpx.HTTPError, ValueError) as e:
        raise SpeechUnavailable(str(e)) from e
