"""Seed the three campus demo stores. Safe to run again: existing emails are reused."""
import asyncio
from typing import Any

import httpx

from app import db
from app.audit import record
from app.util import new_id, now

API = "http://127.0.0.1:8000"
BUYER = ("Campus Student", "student.buyer@campus.test", "CampusBuyer1")
ADMIN = ("Campus Desk", "desk.admin@campus.test", "CampusDesk1")


def questions(*rows: tuple[str, str, str, bool, list[str]]) -> list[dict[str, Any]]:
    return [
        {"id": i, "label": label, "type": kind, "required": required, "options": options}
        for i, label, kind, required, options in rows
    ]


def photo(photo_id: str, width: int, height: int) -> str:
    """Unsplash CDN URL. Short enough for the store banner field, which caps at 500 characters."""
    return f"https://images.unsplash.com/photo-{photo_id}?auto=format&fit=crop&w={width}&h={height}&q=70"


LEND_SETTINGS: dict[str, Any] = {
    "fulfillment_options": ["pickup", "campus_meetup"],
    "payment_options": ["pay_on_pickup", "campus_wallet"],
    "slots_enabled": True,
    "slots": ["12:00-14:00", "16:00-18:00", "18:00-20:00"],
    "slot_required": True,
    "slot_days_ahead": 3,
    "slot_capacity": 4,
    "lead_time_min": 20,
    "queue_min_per_order": 0,
    "max_qty_per_item": 1,
    "order_instructions": (
        "This is a borrow. The price is the fee for the dates you write, not a deposit. "
        "Bring the item back in the same condition. Any cash deposit stays between you and the owner."
    ),
    "custom_fields": questions(
        ("return_by", "Bring it back on", "text", True, []),
        ("use_where", "Where you will use it", "text", True, []),
        ("condition_ok", "I will return it in the same condition", "checkbox", True, []),
    ),
}


STORES: list[dict[str, Any]] = [
    {
        "owner": ("Kaaram", "caram.store@campus.test", "CaramStore1"),
        "name": "Kaaram & Ko",
        "category": "food",
        "logo": "1603133872878-684f208fb84b",
        "banner": "1504674900247-0877df9cc836",
        "tagline": "Wok-fresh fried rice and garlic rice between classes",
        "description": "A campus wok counter. Fried rice, garlic rice, and a few extras, packed for hostel pickup.",
        "announcement": "Lunch wok is on. Tell us your hostel block when you order.",
        "operating_hours": "Mon–Sat 12:00–14:30 and 18:00–20:30",
        "pickup_details": "Kaaram counter, outside the mess, name written on the box",
        "theme": {"primary": "#C65D3A", "accent": "#263D32", "background": "#F7F4ED", "font": "rounded", "radius": "soft"},
        "order_settings": {
            "fulfillment_options": ["pickup", "campus_meetup"],
            "payment_options": ["pay_on_pickup", "campus_wallet"],
            "slots_enabled": True,
            "slots": ["12:00-13:00", "13:00-14:00", "18:00-19:00", "19:00-20:00"],
            "slot_required": True,
            "slot_days_ahead": 1,
            "slot_capacity": 12,
            "lead_time_min": 15,
            "queue_min_per_order": 4,
            "order_instructions": "Say the name on the box when you collect. Spice is cooked in, not added after.",
            "custom_fields": questions(
                ("hostel", "Hostel or block", "select", True, ["A", "B", "C", "D", "Day scholar"]),
                ("spice", "Spice level", "select", True, ["Mild", "Medium", "Hot"]),
                ("onion", "No onion", "checkbox", False, []),
            ),
        },
        "products": [
            {"title": "Veg fried rice", "description": "Rice, mixed vegetables, soy, and spring onion.", "price_minor": 9000, "stock": 40, "prep_time_min": 12, "category": "rice", "addons": "rice", "image": "1603133872878-684f208fb84b"},
            {"title": "Egg fried rice", "description": "The veg wok with two eggs scrambled through the rice.", "price_minor": 11000, "stock": 30, "prep_time_min": 12, "category": "rice", "addons": "rice", "image": "1525351484163-7529414344d8"},
            {"title": "Chicken fried rice", "description": "Small-cut chicken, rice, and the house soy sauce.", "price_minor": 14000, "stock": 24, "prep_time_min": 15, "category": "rice", "addons": "chicken", "image": "1604908176997-125f25cc6f3d"},
            {"title": "Paneer fried rice", "description": "Paneer cubes, pepper, and fried rice.", "price_minor": 13000, "stock": 20, "prep_time_min": 14, "category": "rice", "addons": "rice", "image": "1546069901-ba9599a7e63c"},
            {"title": "Garlic rice", "description": "Rice tossed with garlic, curry leaf, and a little ghee.", "price_minor": 8000, "stock": 36, "prep_time_min": 10, "category": "rice", "addons": "rice", "image": "1512058564366-18510be2db19"},
            {"title": "Garlic rice with egg", "description": "Garlic rice with a fried egg on top.", "price_minor": 10000, "stock": 28, "prep_time_min": 12, "category": "rice", "addons": "rice", "image": "1482049016688-2d3e1b311543"},
            {"title": "Schezwan fried rice", "description": "Hotter sauce, vegetables, and fried rice.", "price_minor": 12000, "stock": 22, "prep_time_min": 14, "category": "rice", "addons": "rice", "image": "1504674900247-0877df9cc836"},
        ],
    },
    {
        "owner": ("Campus Brewers", "thanos.brewers@campus.test", "ThanosBrew1"),
        "name": "Campus Brewers",
        "category": "food",
        "logo": "1572442388796-11668a67e53d",
        "banner": "1509042239860-f550ce710b93",
        "tagline": "Filter, espresso, and cold coffee from the library lawn",
        "description": "A student coffee cart. Order a size, say how you take milk and sugar, and pick it up at the cart.",
        "announcement": "Oat milk is in today. Cold coffee needs about ten extra minutes.",
        "operating_hours": "Mon–Fri 8:00–18:30, Sat 9:00–16:00",
        "pickup_details": "Campus Brewers cart, library lawn, under the neem tree",
        "theme": {"primary": "#8B5A2B", "accent": "#3E2A1C", "background": "#F5EEE4", "font": "serif", "radius": "soft"},
        "order_settings": {
            "fulfillment_options": ["pickup"],
            "payment_options": ["pay_on_pickup", "campus_wallet"],
            "slots_enabled": True,
            "slots": ["12:00-13:00", "15:00-16:00", "17:00-18:00", "18:00-19:00"],
            "slot_required": False,
            "slot_days_ahead": 1,
            "slot_capacity": 10,
            "lead_time_min": 8,
            "queue_min_per_order": 3,
            "order_instructions": "We call the name on the cup. A slot is optional if you can wait at the cart.",
            "custom_fields": questions(
                ("milk", "Milk", "select", True, ["Regular milk", "Oat milk", "No milk"]),
                ("sugar", "Sugar", "select", True, ["No sugar", "Less sugar", "Normal"]),
                ("cup_name", "Name on the cup", "text", True, []),
            ),
        },
        "products": [
            {"title": "Espresso", "description": "A short shot from the campus machine.", "category": "coffee", "prep_time_min": 4, "variants": [("Small", 4000, 40), ("Regular", 5000, 40)], "addons": "coffee", "image": "1511920170033-f8396924c348"},
            {"title": "Americano", "description": "Espresso lengthened with hot water.", "category": "coffee", "prep_time_min": 4, "variants": [("Small", 5000, 40), ("Regular", 7000, 40), ("Large", 9000, 30)], "image": "1497935586351-b67a49e012bf"},
            {"title": "Cappuccino", "description": "Espresso, steamed milk, and foam.", "category": "coffee", "prep_time_min": 6, "variants": [("Small", 7000, 30), ("Regular", 9000, 30), ("Large", 11000, 20)], "image": "1509042239860-f550ce710b93"},
            {"title": "Latte", "description": "More milk, less foam.", "category": "coffee", "prep_time_min": 6, "variants": [("Small", 8000, 30), ("Regular", 10000, 30), ("Large", 12000, 20)], "image": "1572442388796-11668a67e53d"},
            {"title": "Filter coffee", "description": "Decoction and milk, served in a glass.", "category": "coffee", "prep_time_min": 5, "variants": [("Regular", 4000, 50), ("Strong", 5000, 40)], "image": "1442512595331-e89e73853f31"},
            {"title": "Cold coffee", "description": "Blended with milk and a little sugar unless you say otherwise.", "category": "coffee", "prep_time_min": 8, "variants": [("Regular", 9000, 25), ("Large", 12000, 20)], "image": "1461023058943-07fcbe16d735"},
            {"title": "Mocha", "description": "Espresso, cocoa, and milk.", "category": "coffee", "prep_time_min": 6, "variants": [("Regular", 11000, 20), ("Large", 13000, 16)], "image": "1495474472287-4d71bcdd2085"},
        ],
    },
    {
        "owner": ("Tanuj", "thanooj.prints@campus.test", "ThanoojPrint1"),
        "name": "Tanuj Prints",
        "category": "printing",
        "logo": "1612815154858-60aa4c59eaa6",
        "banner": "1586281380349-632531db7ed4",
        "tagline": "Notes, posters, and binding before the submission hour",
        "description": "Upload the file, pick paper and binding, and the price is calculated from the page count before the job reaches the desk.",
        "announcement": "Colour jobs close at 17:30. Urgent adds 25 percent.",
        "operating_hours": "Mon–Sat 9:30–18:00",
        "pickup_details": "Tanuj Prints, shop 2, academic block corridor",
        "theme": {"primary": "#2F5BEA", "accent": "#16213E", "background": "#F3F5FA", "font": "modern", "radius": "sharp"},
        "order_settings": {
            "fulfillment_options": ["pickup", "campus_meetup"],
            "payment_options": ["pay_on_pickup", "manual_confirmation", "campus_wallet"],
            "slots_enabled": True,
            "slots": ["12:00-14:00", "14:00-16:00", "16:00-18:00"],
            "slot_required": True,
            "slot_days_ahead": 2,
            "slot_capacity": 8,
            "lead_time_min": 30,
            "min_order_minor": 0,
            "order_instructions": "Upload the file on the print listing. Page count, paper, sides, binding, and copies are priced before you place the order.",
            "custom_fields": questions(
                ("packet", "Name on the packet", "text", True, []),
            ),
        },
        "products": [
            {"title": "Document printing", "description": "Notes and assignments. Upload a PDF or a photo. Black and white is ₹1 a page, colour is ₹5, then paper and binding.", "kind": "printing", "price_minor": 100, "prep_time_min": 30, "category": "print", "print_spec": True, "image": "1434030216411-0b793f4b4173"},
            {"title": "Colour printing", "description": "Slides, diagrams, and photos. Same rate card: the file's page count sets the price.", "kind": "printing", "price_minor": 500, "prep_time_min": 40, "category": "print", "print_spec": True, "image": "1612815154858-60aa4c59eaa6"},
            {"title": "Poster print", "description": "One poster. Pick the sheet size. This is a fixed price, not a quote.", "kind": "product", "price_minor": 4000, "prep_time_min": 45, "category": "poster", "variants": [("A3", 4000, 20), ("A2", 8000, 12), ("A1", 15000, 6)], "image": "1454165804606-c3d57bc86b40"},
            {"title": "Spiral binding", "description": "Plastic coil. Pick how thick the document is.", "kind": "product", "price_minor": 3000, "prep_time_min": 15, "category": "binding", "variants": [("Up to 50 pages", 3000, 40), ("Up to 150 pages", 5000, 30), ("Up to 300 pages", 8000, 15)], "image": "1517842645767-c639042777db"},
            {"title": "Lamination", "description": "Pouch lamination. Pick the sheet.", "kind": "product", "price_minor": 1500, "prep_time_min": 10, "category": "finish", "variants": [("A4", 1500, 50), ("A3", 3000, 25)], "image": "1562654501-a0ccc0fc3fb1"},
            {"title": "A4 paper ream", "description": "500 sheets. Pick the weight.", "kind": "product", "price_minor": 28000, "prep_time_min": 0, "category": "paper", "variants": [("70 gsm", 28000, 18), ("100 gsm", 42000, 10)], "image": "1586075010923-2dd4570fb338"},
        ],
    },
    {
        "owner": ("Meera", "meera.lend@campus.test", "MeeraLend1"),
        "name": "Meera's Projector",
        "category": "lending",
        "logo": "1478720568477-152d9b164e26",
        "banner": "1478720568477-152d9b164e26",
        "tagline": "One projector, from my room, for society screenings",
        "description": "I lend my own projector. The price is the borrow fee for the dates you write, not a purchase and not a deposit.",
        "announcement": "Book a handover slot. Tell me the day you will bring it back.",
        "operating_hours": "Mon–Sat 16:00–21:00",
        "pickup_details": "Meera, hostel C common room. I hand it over and I take it back there.",
        "theme": {"primary": "#1B3A4B", "accent": "#C65D3A", "background": "#F4F1EA", "font": "modern", "radius": "soft"},
        "order_settings": LEND_SETTINGS,
        "products": [
            {"title": "Portable projector", "description": "Borrow fee covers up to two days. HDMI lead comes with it. One piece, so the next person waits until you bring it back.", "price_minor": 12000, "stock": 1, "prep_time_min": 0, "category": "gear", "listing_type": "lend", "image": "1478720568477-152d9b164e26"},
        ],
    },
    {
        "owner": ("Arjun", "arjun.lend@campus.test", "ArjunLend1"),
        "name": "Arjun Audio",
        "category": "lending",
        "logo": "1608043152269-423dbba4e7e1",
        "banner": "1545454675-3531b543be5d",
        "tagline": "A speaker and a mic from my cupboard, not a shop",
        "description": "I lend sound gear I own. Fee for the dates you name. Bring it back charged, or with the same batteries.",
        "announcement": "The bluetooth speaker is usually free on weekday evenings.",
        "operating_hours": "Mon–Sun 12:00–20:00",
        "pickup_details": "Arjun, library steps. Message me if you are more than ten minutes late.",
        "theme": {"primary": "#6B3A2A", "accent": "#2C1810", "background": "#F6F1EA", "font": "rounded", "radius": "soft"},
        "order_settings": LEND_SETTINGS,
        "products": [
            {"title": "Bluetooth speaker", "description": "Borrow fee for up to a day. Two of these, so a second person can still take one.", "price_minor": 4000, "stock": 2, "prep_time_min": 0, "category": "gear", "listing_type": "lend", "image": "1608043152269-423dbba4e7e1"},
            {"title": "Bookshelf speaker", "description": "Needs a socket. Borrow fee for an evening.", "price_minor": 6000, "stock": 1, "prep_time_min": 0, "category": "gear", "listing_type": "lend", "image": "1545454675-3531b543be5d"},
            {"title": "Small mic", "description": "Clip mic for a talk. Borrow fee for one event.", "price_minor": 3000, "stock": 1, "prep_time_min": 0, "category": "gear", "listing_type": "lend", "image": "1590602847861-f357a9332bbc"},
        ],
    },
    {
        "owner": ("Rhea", "rhea.lend@campus.test", "RheaLend1"),
        "name": "Rhea's Kit",
        "category": "lending",
        "logo": "1581244277943-fe4a9c777189",
        "banner": "1530124566582-a618bc2615dc",
        "tagline": "Screwdrivers and a drill, from my toolbox",
        "description": "I lend tools I use for hostel repairs. The fee is for the borrow. Count the bits when you take the kit and when you bring it back.",
        "announcement": "Drill batteries come full. Bring the drill back before the battery is flat if you can.",
        "operating_hours": "Mon–Fri 17:00–20:00, Sat 11:00–16:00",
        "pickup_details": "Rhea, workshop shed behind hostel B.",
        "theme": {"primary": "#3D4F3A", "accent": "#1E2A1C", "background": "#F3F4EF", "font": "modern", "radius": "sharp"},
        "order_settings": LEND_SETTINGS,
        "products": [
            {"title": "Screwdriver kit", "description": "Bits in a roll. Borrow fee for a day. Two kits.", "price_minor": 2000, "stock": 2, "prep_time_min": 0, "category": "gear", "listing_type": "lend", "image": "1581244277943-fe4a9c777189"},
            {"title": "Cordless drill", "description": "One drill, with a battery. Borrow fee for a day.", "price_minor": 5000, "stock": 1, "prep_time_min": 0, "category": "gear", "listing_type": "lend", "image": "1572981779307-38b8cabb2407"},
        ],
    },
]


async def account(client: httpx.AsyncClient, name: str, email: str, password: str) -> dict[str, str]:
    r = await client.post("/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 401:
        r = await client.post("/api/auth/register", json={"name": name, "email": email, "password": password})
    r.raise_for_status()
    body = r.json()
    return {"token": body["token"], "id": body["user"]["id"]}


ADDONS = {
    "rice": [
        {"name": "Fried egg", "price_minor": 2000, "max_qty": 2},
        {"name": "Extra vegetables", "price_minor": 1500, "max_qty": 1},
    ],
    "chicken": [
        {"name": "Fried egg", "price_minor": 2000, "max_qty": 2},
        {"name": "Extra chicken", "price_minor": 4000, "max_qty": 1},
    ],
    "coffee": [{"name": "Extra shot", "price_minor": 2000, "max_qty": 2}],
}
PRINT_SPEC = {
    "bw_per_page_minor": 100,
    "color_per_page_minor": 500,
    "papers": [
        {"id": "a4", "label": "A4", "extra_per_sheet_minor": 0},
        {"id": "a3", "label": "A3", "extra_per_sheet_minor": 200},
    ],
    "bindings": [
        {"id": "none", "label": "No binding", "price_minor": 0},
        {"id": "staple", "label": "Staples", "price_minor": 500},
        {"id": "spiral", "label": "Spiral", "price_minor": 2000},
    ],
    "allow_duplex": True,
    "urgent_percent": 25,
    "max_copies": 30,
}


def product_body(raw: dict[str, Any]) -> dict[str, Any]:
    variants = [
        {"name": name, "price_minor": price, "stock": stock}
        for name, price, stock in raw.get("variants", [])
    ]
    body: dict[str, Any] = {
        "title": raw["title"],
        "description": raw["description"],
        "kind": raw.get("kind", "product"),
        "listing_type": raw.get("listing_type", "new"),
        "category": raw["category"],
        "price_minor": raw.get("price_minor", variants[0]["price_minor"] if variants else 0),
        "prep_time_min": raw.get("prep_time_min", 0),
        "available": True,
        "variants": variants,
    }
    if "stock" in raw and not variants:
        body["stock"] = raw["stock"]
    addon_key = raw.get("addons") or ("coffee" if raw.get("category") == "coffee" else None)
    if addon_key:
        body["addons"] = ADDONS[addon_key]
    if raw.get("print_spec"):
        body["print_spec"] = PRINT_SPEC
    if raw.get("image"):
        body["image_urls"] = [photo(raw["image"], 800, 600)]
    return body


def store_look(spec: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": spec["name"],
        "tagline": spec["tagline"],
        "description": spec["description"],
        "announcement": spec["announcement"],
        "operating_hours": spec["operating_hours"],
        "pickup_details": spec["pickup_details"],
        "logo_url": photo(spec["logo"], 400, 400),
        "banner_url": photo(spec["banner"], 1400, 560),
        "order_settings": spec["order_settings"],
    }


async def rename_mentions(database: Any, store_id: str, name: str) -> None:
    """Orders and chats keep a copy of the stall name. A rename has to update those copies."""
    for collection in ("orders", "conversations", "subscriptions", "plans"):
        await database[collection].update_many({"store_id": store_id}, {"$set": {"store_name": name}})


async def claim_store(database: Any, store_id: str, owner_id: str) -> None:
    """Point an existing store, its listings, and any orders at the seller who runs it."""
    await database.stores.update_one({"_id": store_id}, {"$set": {"owner_id": owner_id}})
    await database.products.update_many({"store_id": store_id}, {"$set": {"owner_id": owner_id}})
    await database.orders.update_many({"store_id": store_id}, {"$set": {"seller_id": owner_id}})
    await database.plans.update_many({"store_id": store_id}, {"$set": {"seller_id": owner_id}})
    await database.users.update_one({"_id": owner_id}, {"$addToSet": {"roles": "seller"}})


async def seed() -> None:
    database = await db.connect()
    async with httpx.AsyncClient(base_url=API, timeout=30) as client:
        buyer = await account(client, *BUYER)
        await account(client, *ADMIN)
        owners = {spec["owner"][1]: await account(client, *spec["owner"]) for spec in STORES}
        store_ids: dict[str, str] = {}
        for spec in STORES:
            owner = owners[spec["owner"][1]]
            await database.users.update_one({"_id": owner["id"]}, {"$set": {"name": spec["owner"][0]}})
            for collection in ("orders", "subscriptions", "reviews"):
                await database[collection].update_many(
                    {"buyer_id": owner["id"]}, {"$set": {"buyer_name": spec["owner"][0]}},
                )
            headers = {"Authorization": "Bearer " + owner["token"]}
            mine = (await client.get("/api/stores/mine", headers=headers)).json()
            store = next((s for s in mine if s.get("category") == spec["category"]), None)
            if store is None and mine:
                store = mine[0]
            if store is not None:
                if store["owner_id"] != owner["id"]:
                    await claim_store(database, store["id"], owner["id"])
                    print(f"store moved to {spec['owner'][1]}: {spec['name']}")
                else:
                    print(f"store exists: {spec['name']}")
            else:
                payload = {
                    "category": spec["category"], "theme": spec["theme"], **store_look(spec),
                }
                r = await client.post("/api/stores", headers=headers, json=payload)
                r.raise_for_status()
                store = r.json()
                # Demo catalogue stores are already trusted. New signups stay pending for an admin.
                await database.stores.update_one({"_id": store["id"]}, {"$set": {"status": "active"}})
                store["status"] = "active"
                print(f"store created: {store['name']}")
            store_ids[spec["name"]] = store["id"]
            settings = await client.patch(
                f"/api/stores/{store['id']}", headers=headers, json=store_look(spec),
            )
            settings.raise_for_status()
            await rename_mentions(database, store["id"], spec["name"])
            listed = (await client.get(f"/api/stores/{store['id']}/products", headers=headers, params={"include_drafts": True})).json()
            have = {p["title"]: p for p in listed}
            for raw in spec["products"]:
                body = product_body(raw)
                if raw["title"] in have:
                    patch = {k: body[k] for k in ("addons", "print_spec", "description", "image_urls", "listing_type") if k in body}
                    if patch:
                        updated = await client.patch(f"/api/products/{have[raw['title']]['id']}", headers=headers, json=patch)
                        updated.raise_for_status()
                        print(f"  updated {raw['title']}")
                    continue
                created = await client.post(f"/api/stores/{store['id']}/products", headers=headers, json=body)
                created.raise_for_status()
                published = await client.post(f"/api/products/{created.json()['id']}/publish", headers=headers)
                published.raise_for_status()
                print(f"  listed {raw['title']}")
        loaded = await database.wallet_ledger.find_one({"user_id": buyer["id"], "note": "demo desk load"})
        if loaded:
            print("wallet already loaded")
        else:
            topup = await client.post(
                "/api/me/wallet/add",
                headers={"Authorization": "Bearer " + buyer["token"]},
                json={"amount_minor": 50000, "method": "campus_desk", "note": "demo desk load"},
            )
            topup.raise_for_status()
            print("wallet loaded")

    user = await database.users.find_one({"email": ADMIN[1]})
    assert user is not None
    await database.users.update_one({"_id": user["_id"]}, {"$addToSet": {"roles": "admin"}})
    await record(database, "cli", "user.promote_admin", "user", user["_id"])
    print("admin role granted")
    await ensure_demo_vouchers(
        database, store_ids,
        {spec["name"]: owners[spec["owner"][1]]["id"] for spec in STORES},
        user["_id"],
    )


def _voucher(**fields: Any) -> dict[str, Any]:
    doc: dict[str, Any] = {
        "percent": None, "amount_minor": None, "applies_to": "catalogue", "min_subtotal_minor": 0,
        "max_discount_minor": None, "audience": "anyone", "new_account_days": 14, "min_items": 1,
        "categories": [], "kinds": [], "payment_methods": [], "starts_at": None, "ends_at": None,
        "max_redemptions": None, "per_user": 1, "active": True, "redeemed": 0,
    }
    doc.update(fields)
    return doc


async def ensure_demo_vouchers(
    database: Any, store_ids: dict[str, str], owner_ids: dict[str, str], admin_id: str
) -> None:
    rows = [
        _voucher(
            code="FIRSTBITE", store_id=None, owner_id=admin_id, title="First order on campus",
            kind="percent", percent=15, min_subtotal_minor=4000, max_discount_minor=4000,
            audience="first_order", max_redemptions=500,
        ),
        _voucher(
            code="DESK5", store_id=None, owner_id=admin_id, title="Desk five",
            kind="amount", amount_minor=500, min_subtotal_minor=3000,
        ),
        _voucher(
            code="RICE20", store_id=store_ids["Kaaram & Ko"], owner_id=owner_ids["Kaaram & Ko"],
            title="Rice pot", kind="amount", amount_minor=2000, min_subtotal_minor=9000,
        ),
        _voucher(
            code="NEWBREW", store_id=store_ids["Campus Brewers"], owner_id=owner_ids["Campus Brewers"],
            title="New to campus coffee", kind="percent", percent=10, audience="new_account",
            new_account_days=30,
        ),
        _voucher(
            code="INKWALLET", store_id=store_ids["Tanuj Prints"], owner_id=owner_ids["Tanuj Prints"],
            title="Print from wallet", kind="amount", amount_minor=1000, applies_to="priced",
            payment_methods=["campus_wallet"],
        ),
    ]
    for row in rows:
        if await database.vouchers.find_one({"code": row["code"]}):
            print(f"code exists: {row['code']}")
            continue
        row["_id"] = new_id()
        row["created_at"] = now()
        await database.vouchers.insert_one(row)
        print(f"code created: {row['code']}")


if __name__ == "__main__":
    asyncio.run(seed())
