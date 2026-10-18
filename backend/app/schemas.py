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

StoreCategory = Literal["food", "printing", "handmade", "goods", "services", "lending"]
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
PaymentMethod = Literal["pay_on_pickup", "manual_confirmation", "campus_wallet"]


class StoreTheme(Strict):
    primary: HexColor = "#C65D3A"
    accent: HexColor = "#263D32"
    background: HexColor = "#F7F4ED"
    font: Literal["modern", "serif", "rounded"] = "modern"
    radius: Literal["sharp", "soft", "pill"] = "soft"


class CustomField(Strict):
    id: Annotated[str, StringConstraints(pattern=r"^[a-z0-9_]{1,30}$")]
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    type: Literal["text", "select", "checkbox", "date"] = "text"
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


class AddonIn(Strict):
    """A priced extra on one item, such as a fried egg on rice. Charged per item, not per order."""

    id: str | None = None
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    price_minor: int = Field(ge=0, le=10_000_00)
    max_qty: int = Field(default=1, ge=1, le=10)


class PaperRate(Strict):
    id: str | None = None
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    extra_per_sheet_minor: int = Field(default=0, ge=0, le=10_000_00)


class BindingRate(Strict):
    id: str | None = None
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    price_minor: int = Field(default=0, ge=0, le=10_000_00)


class PrintSpec(Strict):
    """Rate card for a print listing. The server prices a job from the file and these rates."""

    bw_per_page_minor: int = Field(ge=0, le=10_000_00)
    color_per_page_minor: int = Field(ge=0, le=10_000_00)
    papers: list[PaperRate] = Field(min_length=1, max_length=6)
    bindings: list[BindingRate] = Field(min_length=1, max_length=6)
    allow_duplex: bool = True
    urgent_percent: int = Field(default=0, ge=0, le=100)
    max_copies: int = Field(default=20, ge=1, le=100)


class ProductIn(Strict):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    description: str = Field(default="", max_length=4000)
    kind: ProductKind = "product"
    listing_type: ListingType = "new"
    category: str = Field(default="general", max_length=40)
    price_minor: int = Field(ge=0, le=100_000_00)
    stock: int | None = Field(default=None, ge=0, le=100_000)  # None = unlimited / service
    variants: list[VariantIn] = Field(default_factory=list, max_length=20)
    addons: list[AddonIn] = Field(default_factory=list, max_length=12)
    print_spec: PrintSpec | None = None
    image_urls: list[str] = Field(default_factory=list, max_length=8)
    available: bool = True
    prep_time_min: int = Field(default=0, ge=0, le=60 * 24 * 14)
    condition: str | None = Field(default=None, max_length=60)
    karma_value: int | None = Field(default=None, ge=0, le=100_000)  # never money
    rate_unit: Literal["day", "hour"] | None = None  # borrow rate; absent means one flat price
    max_units: int | None = Field(default=None, ge=1, le=336)  # seller cap, in days or hours
    featured: bool = False  # seller choice for the home page; not a paid placement


class ProductPatch(Strict):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)] | None = None
    description: str | None = Field(default=None, max_length=4000)
    kind: ProductKind | None = None
    listing_type: ListingType | None = None
    category: str | None = Field(default=None, max_length=40)
    price_minor: int | None = Field(default=None, ge=0, le=100_000_00)
    stock: int | None = Field(default=None, ge=0, le=100_000)
    variants: list[VariantIn] | None = Field(default=None, max_length=20)
    addons: list[AddonIn] | None = Field(default=None, max_length=12)
    print_spec: PrintSpec | None = None
    image_urls: list[str] | None = Field(default=None, max_length=8)
    available: bool | None = None
    prep_time_min: int | None = Field(default=None, ge=0, le=60 * 24 * 14)
    condition: str | None = Field(default=None, max_length=60)
    karma_value: int | None = Field(default=None, ge=0, le=100_000)
    rate_unit: Literal["day", "hour"] | None = None
    max_units: int | None = Field(default=None, ge=1, le=336)
    featured: bool | None = None


class AddonPick(Strict):
    id: str
    quantity: int = Field(ge=1, le=10)


class PrintJobIn(Strict):
    file_url: Annotated[str, StringConstraints(pattern=r"^/uploads/[0-9a-f]{32}\.(pdf|png|jpg|webp)$")]
    color: Literal["bw", "color"]
    paper_id: str
    sides: Literal["single", "duplex"] = "single"
    binding_id: str
    copies: int = Field(ge=1, le=100)
    urgent: bool = False
    note: str = Field(default="", max_length=300)


class AddonPick(Strict):
    id: str
    quantity: int = Field(ge=1, le=10)


class PrintJobIn(Strict):
    file_url: Annotated[str, StringConstraints(pattern=r"^/uploads/[0-9a-f]{32}\.(pdf|png|jpg|webp)$")]
    color: Literal["bw", "color"]
    paper_id: str
    sides: Literal["single", "duplex"] = "single"
    binding_id: str
    copies: int = Field(ge=1, le=100)
    urgent: bool = False
    note: str = Field(default="", max_length=300)


class OrderItemIn(Strict):
    product_id: str
    variant_id: str | None = None
    quantity: int = Field(ge=1, le=99)
    addons: list[AddonPick] = Field(default_factory=list, max_length=12)
    print_job: PrintJobIn | None = None


class PickupSlotIn(Strict):
    date: dt.date
    label: SlotLabel


class OrderIn(Strict):
    store_id: str
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    fulfillment: Fulfillment = "pickup"
    payment_method: PaymentMethod = "pay_on_pickup"
    pickup_slot: PickupSlotIn | None = None
    collect_on: dt.date | None = None
    return_on: dt.date | None = None
    return_time: Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")] | None = None
    answers: dict[
        Annotated[str, StringConstraints(max_length=30)], Annotated[str, StringConstraints(max_length=300)]
    ] = Field(default_factory=dict, max_length=8)
    note: str = Field(default="", max_length=1000)
    request_details: str = Field(default="", max_length=3000)  # printing / service requests
    file_urls: list[str] = Field(default_factory=list, max_length=5)
    voucher_code: Annotated[str, StringConstraints(strip_whitespace=True, max_length=16)] = ""


class VoucherIn(Strict):
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=16, pattern=r"^[A-Za-z0-9]+$")]
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    kind: Literal["percent", "amount"]
    percent: int | None = Field(default=None, ge=1, le=80)
    amount_minor: int | None = Field(default=None, ge=100, le=5_000_00)
    applies_to: Literal["catalogue", "priced"] = "catalogue"
    min_subtotal_minor: int = Field(default=0, ge=0, le=100_000_00)
    max_discount_minor: int | None = Field(default=None, ge=100, le=5_000_00)
    audience: Literal["anyone", "first_order", "first_store_order", "new_account"] = "anyone"
    new_account_days: int = Field(default=14, ge=1, le=90)
    min_items: int = Field(default=1, ge=1, le=20)
    categories: list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]] = Field(
        default_factory=list, max_length=6
    )
    kinds: list[ProductKind] = Field(default_factory=list, max_length=3)
    payment_methods: list[PaymentMethod] = Field(default_factory=list, max_length=3)
    starts_at: dt.datetime | None = None
    ends_at: dt.datetime | None = None
    max_redemptions: int | None = Field(default=None, ge=1, le=10_000)
    per_user: int = Field(default=1, ge=1, le=5)

    @model_validator(mode="after")
    def _check(self) -> "VoucherIn":
        if self.kind == "percent" and self.percent is None:
            raise ValueError("Set the percent off")
        if self.kind == "amount" and self.amount_minor is None:
            raise ValueError("Set the amount off")
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("The end must be after the start")
        self.categories = [" ".join(c.split()) for c in self.categories if c.strip()]
        return self


class VoucherPatch(Strict):
    active: bool


class VoucherPreviewIn(Strict):
    store_id: str
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=16)]
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    payment_method: PaymentMethod = "pay_on_pickup"
    pickup_slot: PickupSlotIn | None = None
    collect_on: dt.date | None = None
    return_on: dt.date | None = None
    return_time: Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")] | None = None


class NotificationReadIn(Strict):
    mark_all: bool = False
    ids: list[str] = Field(default_factory=list, max_length=50)


class StatusIn(Strict):
    status: Literal[
        "accepted", "rejected", "preparing", "ready", "completed", "cancelled"
    ]
    reason: str = Field(default="", max_length=500)


class QuoteIn(Strict):
    total_minor: int = Field(ge=0, le=100_000_00)
    note: str = Field(default="", max_length=500)


class ReviewAspects(Strict):
    quality: int = Field(ge=1, le=5)
    timing: int = Field(ge=1, le=5)
    value: int = Field(ge=1, le=5)


class ReviewIn(Strict):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)
    aspects: ReviewAspects | None = None


class ReviewReplyIn(Strict):
    reply: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class FundsIn(Strict):
    amount_minor: int = Field(ge=1, le=100_000_00)
    note: str = Field(default="", max_length=200)


class AddFundsIn(FundsIn):
    method: Literal["campus_desk", "reference"] = "campus_desk"


class PlanIn(Strict):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    description: str = Field(default="", max_length=500)
    price_minor: int = Field(ge=100, le=100_000_00)
    period: Literal["week", "month"] = "month"
    discount_percent: int = Field(ge=5, le=30)
    active: bool = True


class PlanPatch(Strict):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)] | None = None
    description: str | None = Field(default=None, max_length=500)
    price_minor: int | None = Field(default=None, ge=100, le=100_000_00)
    period: Literal["week", "month"] | None = None
    discount_percent: int | None = Field(default=None, ge=5, le=30)
    active: bool | None = None


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


class StoreDecisionIn(Strict):
    decision: Literal["approved", "rejected"]
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]
