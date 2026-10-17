# Setup

## Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example .env        # set MONGODB_URI and JWT_SECRET (openssl rand -hex 32)
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
Set `VITE_API_URL` when the API is on another origin (the WebSocket URL is derived from it).

## Optional integrations
- **Gemma:** run an OpenAI-compatible server with an open-weight Gemma (e.g. Ollama) and set `GEMMA_BASE_URL`.
- **ElevenLabs:** set `ELEVENLABS_API_KEY` for dictation. Neither has been exercised against the live service; tests use fakes.

## UNO Q assistant
See `edge/uno_q/` and the variables in `.env.example` (API URL, scoped API token from Seller Studio, Telegram token and
allowed chat ids). The MCP server needs `pip install mcp`. Run `campuscart_edge.benchmark` on the device before choosing a
local model; whether any Gemma variant fits in 4 GB RAM is unmeasured. Summaries are rule-based and need no model.

## Deploy (Render + Atlas)
`render.yaml` defines the API web service and the static site. Create an Atlas cluster, set `MONGODB_URI`, `CORS_ORIGINS`
(static site URL) and `VITE_API_URL` (API URL). Uploaded images are written to local disk, which is ephemeral on Render:
attach a persistent disk or move uploads to object storage before relying on them.

## Known limitations
- Chat connections and rate limits are per-process; multi-instance needs a shared pub/sub (Redis) and limiter.
- Karma ledger, rental/exchange workflows, push notifications and email are not implemented (data model only).
- Not verified: real MongoDB Atlas, live Gemma/ElevenLabs/Telegram/MCP, UNO Q hardware, cross-browser UI.
