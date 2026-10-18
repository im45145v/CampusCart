from io import BytesIO
from typing import Any

import httpx
from pypdf import PdfWriter

from app.services.printing import price_job

from .conftest import Actor, make_product
from .test_orders import place

SPEC = {
    "bw_per_page_minor": 100,
    "color_per_page_minor": 500,
    "papers": [
        {"id": "a4", "label": "A4", "extra_per_sheet_minor": 0},
        {"id": "a3", "label": "A3", "extra_per_sheet_minor": 200},
    ],
    "bindings": [
        {"id": "none", "label": "No binding", "price_minor": 0},
        {"id": "spiral", "label": "Spiral", "price_minor": 2000},
    ],
    "allow_duplex": True,
    "urgent_percent": 25,
    "max_copies": 20,
}


def pdf_bytes(pages: int) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=612, height=792)
    buf = BytesIO()
    writer.write(buf)
    return buf.getvalue()


def test_print_math_uses_pages_copies_paper_binding_and_urgent() -> None:
    job = price_job(SPEC, {
        "file_url": "/uploads/" + "a" * 32 + ".pdf",
        "color": "color", "paper_id": "a3", "sides": "duplex", "binding_id": "spiral",
        "copies": 2, "urgent": True, "note": "before class",
    }, pages=5)
    # 10 impressions × ₹5, 6 sheets × ₹2, 2 spirals × ₹20, then 25%
    assert job["impressions"] == 10 and job["sheets"] == 6
    assert job["impression_minor"] == 5000
    assert job["paper_minor"] == 1200
    assert job["binding_minor"] == 4000
    assert job["urgent_minor"] == 2550
    assert job["total_minor"] == 12750


async def test_extras_are_priced_on_the_server(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(
        client, seller, store, title="Fried rice", price_minor=9000,
        addons=[{"name": "Fried egg", "price_minor": 2000, "max_qty": 2}],
    )
    egg = p["addons"][0]["id"]
    o = (await place(client, buyer, store, [{
        "product_id": p["id"], "quantity": 2,
        "addons": [{"id": egg, "quantity": 1}],
    }])).json()
    # (₹90 + ₹20) × 2
    assert o["total_minor"] == 22000
    assert o["items"][0]["addons"][0]["name"] == "Fried egg"
    assert (await place(client, buyer, store, [{
        "product_id": p["id"], "quantity": 1, "addons": [{"id": egg, "quantity": 3}],
    }])).status_code == 422
    assert (await place(client, buyer, store, [{
        "product_id": p["id"], "quantity": 1, "addons": [{"id": "nope", "quantity": 1}],
    }])).status_code == 422
    notes = (await client.get("/api/me/notifications", headers=seller.headers)).json()
    assert notes["unread"] >= 1 and notes["items"][0]["kind"] == "order"
    read = await client.post("/api/me/notifications/read", headers=seller.headers, json={"mark_all": True})
    assert read.status_code == 200
    assert (await client.get("/api/me/notifications", headers=seller.headers)).json()["unread"] == 0


async def test_print_file_is_priced_before_the_seller_sees_it(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(
        client, seller, store, title="Document printing", kind="printing", print_spec=SPEC,
    )
    uploaded = await client.post(
        "/api/uploads/documents", headers=buyer.headers,
        files={"file": ("notes.pdf", pdf_bytes(5), "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text
    body = uploaded.json()
    assert body["pages"] == 5 and body["media"] == "pdf"
    job = {
        "file_url": body["url"], "color": "color", "paper_id": "a3", "sides": "duplex",
        "binding_id": "spiral", "copies": 2, "urgent": True, "note": "before class",
    }
    preview = await client.post(f"/api/products/{p['id']}/print-preview", headers=buyer.headers, json=job)
    assert preview.json()["total_minor"] == 12750
    order = (await place(client, buyer, store, [{"product_id": p["id"], "quantity": 1, "print_job": job}])).json()
    assert order["status"] == "placed" and order["total_minor"] == 12750
    printed = order["items"][0]["print"]
    assert printed["pages"] == 5 and printed["sheets"] == 6 and order["file_urls"] == [body["url"]]
    assert (await place(client, buyer, store, [{"product_id": p["id"], "quantity": 1}])).status_code == 422
