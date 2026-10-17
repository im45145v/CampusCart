# CampusCart

Open-source campus marketplace: discover student-run stores, order products and services, chat with sellers in real time, and run your own store.

- `backend/`: FastAPI + MongoDB (REST + WebSocket chat, orders, reviews, reports, admin, optional Gemma/ElevenLabs)
- `frontend/`: React, TypeScript, Vite, Tailwind
- `edge/uno_q/`: optional Arduino UNO Q seller assistant (Telegram/MCP)
- `docs/`: [architecture](docs/architecture.md), [API](docs/api.md), [security](docs/security.md), [setup](docs/setup.md), [Copilot workflows](docs/copilot-workflows.md)
- `.github/`: Copilot instructions, custom agents and skills for AI-assisted development

Quick start: see [docs/setup.md](docs/setup.md). Payments are pay-on-pickup or paid directly to the seller; CampusCart does not verify payments.

License: see [LICENSE](LICENSE).
