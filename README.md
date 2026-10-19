# UniCart

Open-source campus marketplace: discover student-run stores, order products and services, chat with sellers in real time, and run your own store.

- `backend/`: FastAPI + MongoDB (REST + WebSocket chat, orders, reviews, reports, admin, optional Gemma/ElevenLabs)
- `frontend/`: React, TypeScript, Vite, Tailwind
- `edge/uno_q/`: optional Arduino UNO Q seller assistant (Telegram/MCP)
- `docs/`: [guide](docs/guide.md), [architecture](docs/architecture.md), [API](docs/api.md), [security](docs/security.md), [setup](docs/setup.md), [Copilot workflows](docs/copilot-workflows.md)
- `.github/`: Copilot instructions, custom agents and skills for AI-assisted development

Quick start: see [docs/setup.md](docs/setup.md). Deploy checklist: [docs/deploy.md](docs/deploy.md). Submission draft: [docs/submission.md](docs/submission.md). A stall chooses pay on pickup, pay the seller directly, or campus-wallet credits. A stall that keeps only campus wallet is listed as pay upfront: the credits are taken when the price is known, and cash at collection is not offered. A wallet top-up stays pending until UniCart verifies YouPI’s signed UPI confirmation. UniCart does not read the bank itself. Cancel or reject returns those credits once. A completed order leaves them with the seller.



Other seeded accounts: `thanos.brewers@campus.test` / `ThanosBrew1`, `thanooj.prints@campus.test` / `ThanoojPrint1`, and admin `desk.admin@campus.test` / `CampusDesk1`. Kaaram & Ko and Campus Brewers still take cash at pickup. Tanuj Prints and Potato's Makerspace are pay upfront. Lending is one stall, Potato's Makerspace: `potato.lend@campus.test` / `PotatoLend1`. It lists the projector, speakers, mic, screwdriver kit, and drill. The fee is the listing’s daily or hourly rate. Marking a loan "Back on the shelf" completes the order, returns the piece, and leaves the fee with the lender.

Live demo: not deployed in this repository. Fill the Render and .tech URLs in [docs/submission.md](docs/submission.md) after you follow [docs/deploy.md](docs/deploy.md).

Commits after 18 October 2026, 11:59 PM PDT: none.

License: see [LICENSE](LICENSE).
