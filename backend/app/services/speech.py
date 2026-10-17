import httpx

from ..config import get_settings

MAX_AUDIO_BYTES = 10 * 1024 * 1024
ALLOWED_PREFIXES = ("audio/", "video/webm")


class SpeechUnavailable(Exception):
    pass


async def transcribe(data: bytes, content_type: str, filename: str = "audio") -> str:
    """Speech-to-text via ElevenLabs. Returns transcript text only; nothing is acted upon."""
    s = get_settings()
    if not s.elevenlabs_api_key:
        raise SpeechUnavailable("ElevenLabs is not configured")
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
