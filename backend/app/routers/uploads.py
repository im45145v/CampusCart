from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..config import get_settings
from ..deps import CurrentUser, SellerUser
from ..services.printing import read_pages
from ..util import new_id

router = APIRouter(prefix="/api", tags=["uploads"])

SIGNATURES = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".webp": (b"RIFF",),
}


def detect_ext(data: bytes) -> str | None:
    for ext, sigs in SIGNATURES.items():
        if any(data.startswith(s) for s in sigs):
            if ext == ".webp" and data[8:12] != b"WEBP":
                continue
            return ext
    return None


@router.post("/uploads", status_code=201)
async def upload_image(seller: SellerUser, file: UploadFile = File(...)) -> dict[str, str]:
    s = get_settings()
    data = await file.read(s.max_upload_bytes + 1)
    if len(data) > s.max_upload_bytes:
        raise HTTPException(413, "File too large")
    ext = detect_ext(data)  # trust content, never the client-supplied name or type
    if not ext:
        raise HTTPException(415, "Only PNG, JPEG or WebP images are allowed")
    folder = Path(s.upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{new_id()}{ext}"
    (folder / name).write_bytes(data)
    return {"url": f"/uploads/{name}"}


@router.post("/uploads/documents", status_code=201)
async def upload_document(user: CurrentUser, file: UploadFile = File(...)) -> dict[str, Any]:
    """Store a print file and report how many pages it contains. The file is not printed here."""
    del user
    s = get_settings()
    data = await file.read(s.max_upload_bytes + 1)
    if len(data) > s.max_upload_bytes:
        raise HTTPException(413, "File too large")
    suffix = ".pdf" if data.startswith(b"%PDF") else detect_ext(data)
    if suffix not in {".pdf", ".png", ".jpg", ".webp"}:
        raise HTTPException(415, "Upload a PDF, PNG, JPEG, or WebP")
    pages, media = read_pages(data, suffix)
    folder = Path(s.upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{new_id()}{suffix}"
    (folder / name).write_bytes(data)
    return {"url": f"/uploads/{name}", "pages": pages, "media": media, "bytes": len(data)}
