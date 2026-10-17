import datetime as dt
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, to_lower=True, max_length=254,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    ),
]
Text = Annotated[str, StringConstraints(strip_whitespace=True)]

StoreCategory = Literal["food", "printing", "handmade", "goods", "services"]
ProductKind = Literal["product", "service", "printing"]
ListingType = Literal["new", "secondhand", "rent", "lend", "exchange"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
# Only our own uploads or https images: the value ends up in <img src>.
ImageUrl = Annotated[str, StringConstraints(max_length=500, pattern=r"^(/uploads/[\w.\-]+|https://\S+)$")]
SlotLabel = Annotated[
    str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$")
]
Fulfillment = Literal["pickup", "campus_meetup"]
PaymentMethod = Literal["pay_on_pickup", "manual_confirmation"]


class StoreTheme(Strict):
    primary: HexColor = "#C65D3A"
    accent: HexColor = "#263D32"
    background: HexColor = "#F7F4ED"
    font: Literal["modern", "serif", "rounded"] = "modern"
    radius: Literal["sharp", "soft", "pill"] = "soft"


class CustomField(Strict):
    id: Annotated[str, StringConstraints(pattern=r"^[a-z0-9_]{1,30}$")]
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    type: Literal["text", "select", "checkbox"] = "text"
    required: bool = False
    options: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]] = Field(
        default_factory=list, max_length=12
    )

    @model_validator(mode="after")
    def _select_needs_options(self) -> "CustomField":
        if self.type == "select" and len(self.options) < 2:
            raise ValueError("select fields need at least two options")
        return self


def _default_fulfillment() -> list[Fulfillment]:
    return ["pickup", "campus_meetup"]


def _default_payments() -> list[PaymentMethod]:
    return ["pay_on_pickup", "manual_confirmation"]


class OrderSettings(Strict):
    """Per-store checkout rules. Every store can tune these; defaults match a plain store."""

    fulfillment_options: list[Fulfillment] = Field(default_factory=_default_fulfillment, min_length=1)
    payment_options: list[PaymentMethod] = Field(default_factory=_default_payments, min_length=1)
    slots_enabled: bool = False
    slots: list[SlotLabel] = Field(default_factory=list, max_length=24)
    slot_required: bool = True
    slot_days_ahead: int = Field(default=1, ge=0, le=7)
    slot_capacity: int = Field(default=0, ge=0, le=200)  # orders per slot, 0 = unlimited
    utc_offset_min: int = Field(default=330, ge=-720, le=840)  # store-local time, default IST
    max_qty_per_item: int = Field(default=99, ge=1, le=99)
    min_order_minor: int = Field(default=0, ge=0, le=100_000_00)
    lead_time_min: int = Field(default=0, ge=0, le=1440)
    queue_min_per_order: int = Field(default=0, ge=0, le=120)
    order_instructions: str = Field(default="", max_length=300)
    custom_fields: list[CustomField] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def _consistent(self) -> "OrderSettings":
        if len(set(self.slots)) != len(self.slots):
            raise ValueError("duplicate time slots")
        for s in self.slots:
            if s[:5] >= s[6:]:
                raise ValueError(f"slot {s} must end after it starts")
        if self.slots_enabled and not self.slots:
            raise ValueError("add at least one time slot or turn slots off")
        if len({f.id for f in self.custom_fields}) != len(self.custom_fields):
            raise ValueError("duplicate custom field ids")
        return self


class RegisterIn(Strict):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    email: Email
    password: str = Field(min_length=8, max_length=128)


class LoginIn(Strict):
    email: Email
    password: str = Field(max_length=128)


class StoreIn(Strict):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    description: str = Field(default="", max_length=2000)
    category: StoreCategory
    logo_url: str | None = Field(default=None, max_length=500)
    banner_url: ImageUrl | None = None
    tagline: str = Field(default="", max_length=120)
    announcement: str = Field(default="", max_length=300)
    theme: StoreTheme = Field(default_factory=StoreTheme)
    order_settings: OrderSettings = Field(default_factory=OrderSettings)
    image_urls: list[str] = Field(default_factory=list, max_length=8)
    operating_hours: str = Field(default="", max_length=300)
    pickup_details: str = Field(default="", max_length=500)
    is_open: bool = True


class StorePatch(Strict):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)] | None = None
    description: str | None = Field(default=None, max_length=2000)
    category: StoreCategory | None = None
    logo_url: str | None = Field(default=None, max_length=500)
    banner_url: ImageUrl | None = None
    tagline: str | None = Field(default=None, max_length=120)
    announcement: str | None = Field(default=None, max_length=300)
    theme: StoreTheme | None = None
    order_settings: OrderSettings | None = None
    image_urls: list[str] | None = Field(default=None, max_length=8)
    operating_hours: str | None = Field(default=None, max_length=300)
    pickup_details: str | None = Field(default=None, max_length=500)
    is_open: bool | None = None


class VariantIn(Strict):
    id: str | None = None
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    price_minor: int = Field(ge=0, le=100_000_00)
    stock: int | None = Field(default=None, ge=0, le=100_000)


class ProductIn(Strict):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    description: str = Field(default="", max_length=4000)
    kind: ProductKind = "product"
    listing_type: ListingType = "new"
    category: str = Field(default="general", max_length=40)
    price_minor: int = Field(ge=0, le=100_000_00)
    stock: int | None = Field(default=None, ge=0, le=100_000)  # None = unlimited / service
    variants: list[VariantIn] = Field(default_factory=list, max_length=20)
    image_urls: list[str] = Field(default_factory=list, max_length=8)
    available: bool = True
    prep_time_min: int = Field(default=0, ge=0, le=60 * 24 * 14)
    condition: str | None = Field(default=None, max_length=60)
    karma_value: int | None = Field(default=None, ge=0, le=100_000)  # never money


class ProductPatch(Strict):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)] | None = None
    description: str | None = Field(default=None, max_length=4000)
    kind: ProductKind | None = None
    listing_type: ListingType | None = None
    category: str | None = Field(default=None, max_length=40)
    price_minor: int | None = Field(default=None, ge=0, le=100_000_00)
    stock: int | None = Field(default=None, ge=0, le=100_000)
    variants: list[VariantIn] | None = Field(default=None, max_length=20)
    image_urls: list[str] | None = Field(default=None, max_length=8)
    available: bool | None = None
    prep_time_min: int | None = Field(default=None, ge=0, le=60 * 24 * 14)
    condition: str | None = Field(default=None, max_length=60)
    karma_value: int | None = Field(default=None, ge=0, le=100_000)


class OrderItemIn(Strict):
    product_id: str
    variant_id: str | None = None
    quantity: int = Field(ge=1, le=99)


class PickupSlotIn(Strict):
    date: dt.date
    label: SlotLabel


class OrderIn(Strict):
    store_id: str
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    fulfillment: Fulfillment = "pickup"
    payment_method: PaymentMethod = "pay_on_pickup"
    pickup_slot: PickupSlotIn | None = None
    answers: dict[
        Annotated[str, StringConstraints(max_length=30)], Annotated[str, StringConstraints(max_length=300)]
    ] = Field(default_factory=dict, max_length=8)
    note: str = Field(default="", max_length=1000)
    request_details: str = Field(default="", max_length=3000)  # printing / service requests
    file_urls: list[str] = Field(default_factory=list, max_length=5)


class StatusIn(Strict):
    status: Literal[
        "accepted", "rejected", "preparing", "ready", "completed", "cancelled"
    ]
    reason: str = Field(default="", max_length=500)


class QuoteIn(Strict):
    total_minor: int = Field(ge=0, le=100_000_00)
    note: str = Field(default="", max_length=500)


class ReviewIn(Strict):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class ReportIn(Strict):
    target_type: Literal["store", "product", "conversation", "order"]
    target_id: str
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]
    details: str = Field(default="", max_length=2000)


class ResolveReportIn(Strict):
    status: Literal["resolved", "dismissed"]
    resolution: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]


class ConversationIn(Strict):
    store_id: str
    order_id: str | None = None
    product_id: str | None = None


class MessageIn(Strict):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class ListingDraftIn(Strict):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=3000)]


class ModerationIn(Strict):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]
