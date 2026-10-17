from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from ..deps import SellerUser
from ..ratelimit import enforce
from ..schemas import ListingDraftIn
from ..services import llm, speech

router = APIRouter(prefix="/api/ai", tags=["ai"])

ProviderDep = Annotated[llm.LLMProvider | None, Depends(llm.get_provider)]


@router.post("/listing-draft")
async def listing_draft(
    body: ListingDraftIn, request: Request, seller: SellerUser, provider: ProviderDep
) -> dict[str, Any]:
    """Returns a *draft only*. The seller must review it and create/publish via the normal API."""
    enforce(request, "ai", 20, 60)
    if provider is None:
        raise HTTPException(503, "AI assistant is not configured. Create the listing manually.")
    try:
        return await llm.build_draft(body.text, provider)
    except llm.LLMUnavailable:
        raise HTTPException(
            503, "AI assistant is unavailable right now. Create the listing manually."
        ) from None


@router.post("/transcribe")
async def transcribe(
    request: Request, seller: SellerUser, audio: UploadFile = File(...)
) -> dict[str, str]:
    enforce(request, "stt", 10, 60)
    ctype = audio.content_type or ""
    if not ctype.startswith(speech.ALLOWED_PREFIXES):
        raise HTTPException(415, "Unsupported audio type")
    data = await audio.read(speech.MAX_AUDIO_BYTES + 1)
    if len(data) > speech.MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio too large")
    if not data:
        raise HTTPException(422, "Empty audio")
    try:
        text = await speech.transcribe(data, ctype, "dictation")
    except speech.SpeechUnavailable:
        raise HTTPException(
            503, "Voice transcription is unavailable. Please type your listing instead."
        ) from None
    return {"transcript": text}
