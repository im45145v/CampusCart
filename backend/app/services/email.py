"""Sign-in email via Resend. The code and link are the message; nothing else is fetched."""

from html import escape

import httpx
from fastapi import HTTPException

RESEND_URL = "https://api.resend.com/emails"


async def send_login_email(*, api_key: str, sender: str, to: str, code: str, link: str) -> None:
    safe_code = escape(code)
    safe_link = escape(link, quote=True)
    text = (
        f"Your UniCart sign-in code is {code}.\n\n"
        "It expires in 10 minutes. You can also open this link:\n"
        f"{link}\n\n"
        "If you did not try to sign in, you can ignore this email."
    )
    html = (
        "<p>Your UniCart sign-in code is "
        f"<strong style=\"letter-spacing:0.2em\">{safe_code}</strong>.</p>"
        "<p>It expires in 10 minutes. Or use this link:</p>"
        f"<p><a href=\"{safe_link}\">Sign in to UniCart</a></p>"
        "<p>If you did not try to sign in, you can ignore this email.</p>"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "from": sender,
                    "to": [to],
                    "subject": "Your UniCart sign-in code",
                    "text": text,
                    "html": html,
                },
            )
    except httpx.HTTPError:
        raise HTTPException(502, "Could not send the sign-in email") from None
    if res.status_code >= 400:
        raise HTTPException(502, "Could not send the sign-in email")
