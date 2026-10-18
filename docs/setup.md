# Setup

## Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example .env        # set MONGODB_URI and JWT_SECRET (openssl rand -hex 32)
# ADMIN_UPI_ID is the desk UPI on the add-funds form. Default im45145v@oksbi. Not a secret.
uvicorn app.main:app --reload  # http://localhost:8000/docs
python -m scripts.create_admin you@example.com   # after registering, to become an administrator
ruff check . && mypy app && pytest
```
Tests use `mongomock-motor`, so no database is required. They have not been run against a real MongoDB/Atlas instance.

## Frontend
```bash
cd frontend
npm ci
npm run dev                    # http://localhost:5173
npm run lint && npm run typecheck && npm test && npm run build
```
Set `VITE_API_URL` when the API is on another origin (the WebSocket URL is derived from it). The default `CORS_ORIGINS` allows both `http://localhost:5173` and `http://127.0.0.1:5173`, because the chat socket rejects any other page origin.

## Demo stalls
With the API running and MongoDB reachable:

```bash
cd backend && python -m scripts.seed_campus_stores
```

This creates Kaaram & Ko, Campus Brewers, Tanuj Prints, and Potato's Makerspace, approves them, publishes their listings, and, the first time, requests ₹500 for `student.buyer@campus.test` then approves that top-up so the credits are spendable. Veg fried rice, Filter coffee, Document printing, and the Portable projector start featured on the home page. A stall can feature three listings. That flag is free and does not expire. Kaaram & Ko and Campus Brewers take cash at pickup or campus credits. Tanuj Prints and Potato's Makerspace are pay upfront: campus credits only, taken when the price is known. Running it again renames those stalls if they still have the old spelling, updates listings and those payment rules, hides the earlier separate lending stalls, and does not add another wallet load. Login emails stay the same. Accounts and the two-minute path are in the README. Catalogue photos are internet image URLs, so a Render restart does not empty the stalls.

## Optional integrations
- **Gemma 4:** set `GEMMA_API_KEY` (Google AI Studio). Listing drafts and dictation call `generateContent` on `gemma-4-26b-a4b-it` (use `gemma-4-31b-it` if you prefer the larger model). Hosted 26B and 31B are text and image; if a recording is refused, type the note. `GEMMA_BASE_URL` still points drafts at a local OpenAI-compatible server instead.
- **ElevenLabs:** optional dictation fallback when `ELEVENLABS_API_KEY` is set. Live Google and ElevenLabs calls are not exercised here; tests use fakes.

## UNO Q assistant
See `edge/uno_q/` and the variables in `.env.example` (API URL, scoped API token from Seller Studio, Telegram token and
allowed chat ids). The MCP server needs `pip install mcp`. Run `campuscart_edge.benchmark` on the device before choosing a
local model; whether any Gemma variant fits in 4 GB RAM is unmeasured. Summaries are rule-based and need no model.

## Deploy (Render + Atlas)
Follow [deploy.md](deploy.md). `render.yaml` defines the API web service and the static site. Uploaded images and print files are written to local disk, which is ephemeral on Render.

## Known limitations
- Chat connections and rate limits are per-process; multi-instance needs a shared pub/sub (Redis) and limiter.
- A lending store holds a piece while it is borrowed and puts it back when the owner marks the order completed. There is no deposit ledger: the price is the borrow fee. Karma, a full rental calendar, and push notifications are not implemented. Sign-in email is sent only when `RESEND_API_KEY` is set.
- Not verified: real MongoDB Atlas, a live Gemma 4 or ElevenLabs call on this machine (the studio reports that the assistant is not configured until `GEMMA_API_KEY` is set), Telegram/MCP, UNO Q hardware, cross-browser UI.
