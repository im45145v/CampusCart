from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

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
    image_urls: list[str] = Field(default_factory=list, max_length=8)
    operating_hours: str = Field(default="", max_length=300)
    pickup_details: str = Field(default="", max_length=500)
    is_open: bool = True


class StorePatch(Strict):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)] | None = None
    description: str | None = Field(default=None, max_length=2000)
    category: StoreCategory | None = None
    logo_url: str | None = Field(default=None, max_length=500)
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


class OrderIn(Strict):
    store_id: str
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    fulfillment: Literal["pickup", "campus_meetup"] = "pickup"
    payment_method: Literal["pay_on_pickup", "manual_confirmation"] = "pay_on_pickup"
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
