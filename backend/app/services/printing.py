"""Read a print file and price it from the listing's rate card.

The buyer does not send a total. Page count comes from the file, and every rupee
is integer minor units:

    impressions = pages × copies
    impression  = impressions × (colour rate or black-and-white rate)
    sheets      = ceil(pages / sides) × copies
    paper       = sheets × extra per sheet
    binding     = copies × binding price
    urgent      = (impression + paper + binding) × urgent percent // 100
"""

from io import BytesIO
from math import ceil
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from ..config import get_settings

MAX_PAGES = 200
IMAGE_PAGES = {
    ".png": b"\x89PNG\r\n\x1a\n",
    ".jpg": b"\xff\xd8\xff",
}


def upload_path(url: str) -> Path:
    name = url.rsplit("/", 1)[-1]
    path = (Path(get_settings().upload_dir) / name).resolve()
    root = Path(get_settings().upload_dir).resolve()
    if path.parent != root or not path.is_file():
        raise HTTPException(422, "That file is no longer available. Upload it again.")
    return path


def read_pages(data: bytes, suffix: str) -> tuple[int, str]:
    """Return (page count, media). Images are one page. PDFs are counted, never executed."""
    if suffix == ".pdf":
        return _pdf_pages(data), "pdf"
    if suffix == ".webp":
        if not (data.startswith(b"RIFF") and data[8:12] == b"WEBP"):
            raise HTTPException(415, "That image could not be read")
        return 1, "image"
    expected = IMAGE_PAGES.get(suffix)
    if expected and data.startswith(expected):
        return 1, "image"
    raise HTTPException(415, "Upload a PDF, PNG, JPEG, or WebP")


def _pdf_pages(data: bytes) -> int:
    if not data.startswith(b"%PDF"):
        raise HTTPException(415, "Upload a PDF, PNG, JPEG, or WebP")
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise HTTPException(422, "This PDF is password protected. Upload an unlocked file.")
        pages = len(reader.pages)
    except HTTPException:
        raise
    except (PdfReadError, ValueError, OSError) as exc:
        raise HTTPException(422, "We could not read that PDF. Export it again and upload the new file.") from exc
    if pages < 1 or pages > MAX_PAGES:
        raise HTTPException(422, f"A print job must be between 1 and {MAX_PAGES} pages")
    return pages


def inspect_upload(url: str) -> dict[str, Any]:
    path = upload_path(url)
    data = path.read_bytes()
    pages, media = read_pages(data, path.suffix.lower())
    return {"file_url": url, "pages": pages, "media": media, "bytes": len(data)}


def price_job(spec: dict[str, Any], job: dict[str, Any], pages: int) -> dict[str, Any]:
    if pages < 1 or pages > MAX_PAGES:
        raise HTTPException(422, f"A print job must be between 1 and {MAX_PAGES} pages")
    copies = int(job["copies"])
    if copies < 1 or copies > int(spec["max_copies"]):
        raise HTTPException(422, f"This listing allows 1 to {spec['max_copies']} copies")
    sides = job["sides"]
    if sides == "duplex" and not spec.get("allow_duplex", True):
        raise HTTPException(422, "This listing is single-sided only")
    paper = next((p for p in spec["papers"] if p["id"] == job["paper_id"]), None)
    binding = next((b for b in spec["bindings"] if b["id"] == job["binding_id"]), None)
    if not paper or not binding:
        raise HTTPException(422, "Choose a paper and a binding from this listing")
    per_sheet = 2 if sides == "duplex" else 1
    sheets = ceil(pages / per_sheet) * copies
    impressions = pages * copies
    rate = spec["color_per_page_minor"] if job["color"] == "color" else spec["bw_per_page_minor"]
    impression_minor = impressions * int(rate)
    paper_minor = sheets * int(paper["extra_per_sheet_minor"])
    binding_minor = copies * int(binding["price_minor"])
    subtotal = impression_minor + paper_minor + binding_minor
    urgent = bool(job.get("urgent"))
    urgent_minor = subtotal * int(spec.get("urgent_percent") or 0) // 100 if urgent else 0
    return {
        "file_url": job["file_url"],
        "pages": pages,
        "copies": copies,
        "color": job["color"],
        "paper_id": paper["id"],
        "paper": paper["label"],
        "sides": sides,
        "binding_id": binding["id"],
        "binding": binding["label"],
        "urgent": urgent,
        "impressions": impressions,
        "sheets": sheets,
        "impression_minor": impression_minor,
        "paper_minor": paper_minor,
        "binding_minor": binding_minor,
        "urgent_minor": urgent_minor,
        "total_minor": subtotal + urgent_minor,
        "note": (job.get("note") or "").strip(),
    }
