from typing import Any


def rupees(minor: int) -> str:
    return f"₹{minor / 100:,.2f}"


def summarize_pending(orders: list[dict[str, Any]]) -> str:
    """Deterministic summary so the device works without any local model."""
    if not orders:
        return "No open orders right now."
    lines = [f"{len(orders)} open order(s). Prepare in this order:"]
    for i, o in enumerate(orders[:10], 1):
        items = ", ".join(f"{x['quantity']}x {x['title']}" for x in o["items"])
        pay = "paid" if o["payment_status"] != "unpaid" else "pay on pickup"
        lines.append(f"{i}. [{o['status']}] {o['buyer_name']}: {items} ({rupees(o['total_minor'])}, {pay})")
    return "\n".join(lines)


def summarize_low_stock(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "Nothing is running low."
    return "Low stock:\n" + "\n".join(
        f"- {r['title']}{' / ' + r['variant'] if r['variant'] else ''}: {r['stock']} left" for r in rows
    )


def summarize_sales(d: dict[str, Any]) -> str:
    return f"Today: {d['orders_completed']} completed order(s), {rupees(d['revenue_minor'])}."
