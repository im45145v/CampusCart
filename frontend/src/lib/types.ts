export type Role = 'buyer' | 'seller' | 'admin'
export interface User { id: string; name: string; email: string; roles: Role[]; karma_balance: number; wallet_balance_minor: number }
export type StoreCategory = 'food' | 'printing' | 'handmade' | 'goods' | 'services'
export interface StoreTheme {
  primary: string; accent: string; background: string
  font: 'modern' | 'serif' | 'rounded'; radius: 'sharp' | 'soft' | 'pill'
}
export interface CustomField { id: string; label: string; type: 'text' | 'select' | 'checkbox'; required: boolean; options: string[] }
export interface OrderSettings {
  fulfillment_options: ('pickup' | 'campus_meetup')[]; payment_options: ('pay_on_pickup' | 'manual_confirmation' | 'campus_wallet')[]
  slots_enabled: boolean; slots: string[]; slot_required: boolean; slot_days_ahead: number; slot_capacity: number
  utc_offset_min: number; max_qty_per_item: number; min_order_minor: number; lead_time_min: number
  queue_min_per_order: number; order_instructions: string; custom_fields: CustomField[]
}
export interface OrderOptions extends OrderSettings {
  days: { date: string; slots: { label: string; remaining: number | null; available: boolean }[] }[]
  is_open: boolean; current_wait_min: number
}
export interface Store {
  id: string; owner_id: string; name: string; description: string; category: StoreCategory
  logo_url: string | null; banner_url?: string | null; tagline?: string; announcement?: string
  theme?: StoreTheme; order_settings?: OrderSettings
  image_urls: string[]; operating_hours: string; pickup_details: string
  is_open: boolean; status: string; review_reason?: string | null
  rating_avg: number; rating_count: number
  rating_hist?: Record<string, number>
}
export interface Variant { id: string; name: string; price_minor: number; stock: number | null }
export interface Addon { id: string; name: string; price_minor: number; max_qty: number }
export interface PrintSpec {
  bw_per_page_minor: number; color_per_page_minor: number
  papers: { id: string; label: string; extra_per_sheet_minor: number }[]
  bindings: { id: string; label: string; price_minor: number }[]
  allow_duplex: boolean; urgent_percent: number; max_copies: number
}
export interface Product {
  id: string; store_id: string; title: string; description: string
  kind: 'product' | 'service' | 'printing'
  listing_type: 'new' | 'secondhand' | 'rent' | 'lend' | 'exchange'
  category: string; price_minor: number; price_from_minor: number; stock: number | null
  variants: Variant[]; addons?: Addon[]; print_spec?: PrintSpec | null
  image_urls: string[]; available: boolean; prep_time_min: number
  published: boolean; in_stock: boolean; moderation_status: string; sold_count: number
  condition?: string | null
}
export interface OrderLine {
  product_id: string; variant_id: string | null; title: string; variant_name: string | null
  unit_price_minor: number; quantity: number; line_total_minor: number
  addons?: { id: string; name: string; price_minor: number; quantity: number }[]
  print?: {
    file_url: string; pages: number; copies: number; color: 'bw' | 'color'
    paper: string; sides: 'single' | 'duplex'; binding: string; urgent: boolean
    impressions: number; sheets: number
    impression_minor: number; paper_minor: number; binding_minor: number; urgent_minor: number
    note: string
  } | null
}
export interface AppNotification {
  id: string; kind: string; title: string; body: string; href: string
  related_id: string | null; read: boolean; created_at: string
}
export type OrderStatus =
  | 'placed' | 'quote_requested' | 'quoted' | 'accepted' | 'preparing'
  | 'ready' | 'completed' | 'rejected' | 'cancelled'
export interface Order {
  id: string; buyer_id: string; buyer_name: string; seller_id: string; store_id: string
  store_name: string; items: OrderLine[]; total_minor: number; estimated_minor: number
  discount_minor?: number; subscription_id?: string | null
  voucher_code?: string | null; voucher_title?: string | null; voucher_discount_minor?: number
  fulfillment: string; payment_method: string; payment_status: string; note: string
  request_details: string; status: OrderStatus; created_at: string
  pickup_slot?: { date: string; label: string } | null
  answers?: { id: string; label: string; value: string }[]
  est_wait_min?: number
  history: { status: string; at: string; reason: string }[]
}
export interface Conversation {
  id: string; store_id: string; store_name: string; order_id: string | null
  other_user: { id: string; name: string; online: boolean }
  unread: number; last_seq: number; other_read_seq: number
  last_message: { text: string; sender_id: string; at: string; seq: number } | null
  updated_at: string
}
export interface Message {
  id: string; conversation_id: string; seq: number; sender_id: string
  text: string; created_at: string; client_id?: string | null
}
export interface ReviewAspects { quality: number; timing: number; value: number }
export interface Review {
  id: string; rating: number; comment: string; buyer_name: string; created_at: string
  aspects?: ReviewAspects | null; seller_reply?: string | null; seller_reply_at?: string | null
}
export interface WalletEntry {
  id: string; user_id?: string; amount_minor: number; direction: 'credit' | 'debit'; reason: string
  note: string; method: string | null; status: string; balance_after_minor: number
  related_id: string | null; created_at: string
}
export interface Wallet { balance_minor: number; entries: WalletEntry[] }
export interface Plan {
  id: string; store_id: string; title: string; description: string; price_minor: number
  period: 'week' | 'month'; discount_percent: number; active: boolean; store_name?: string
}
export interface Subscription {
  id: string; plan_id: string; store_id: string; store_name: string; title: string
  price_minor: number; period: 'week' | 'month'; discount_percent: number
  status: string; period_end: string; buyer_name?: string
}
export interface Voucher {
  id: string; code: string; title: string; summary: string
  kind: 'percent' | 'amount'; percent?: number | null; amount_minor?: number | null
  audience: string; active?: boolean; redeemed?: number; max_redemptions?: number | null
  store_id?: string | null
}
export interface VoucherQuote {
  code: string; title: string; summary: string
  estimated_minor: number; membership_discount_minor: number
  discount_minor: number; payable_minor: number; message: string
}
export interface SellerCharts {
  days: { date: string; revenue_minor: number; orders: number }[]
  by_status: Record<string, number>
}
export interface Report {
  id: string; target_type: string; target_id: string; reason: string; details: string
  status: string; resolution: string | null; created_at: string
}
export interface Summary {
  orders_by_status: Record<string, number>
  today: { orders_completed: number; revenue_minor: number }
  last_30_days: { orders_completed: number; revenue_minor: number }
  low_stock: { product_id: string; title: string; variant: string | null; stock: number }[]
}
export interface Draft {
  draft: {
    title: string | null; description: string | null; kind: string | null
    listing_type: string; category: string | null; price_minor: number | null
    stock: number | null; prep_time_min: number | null
  }
  missing_fields: string[]; warnings: string[]
}
