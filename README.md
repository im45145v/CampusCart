# CampusCart

Open-source campus marketplace: discover student-run stores, order products and services, chat with sellers in real time, and run your own store.

- `backend/`: FastAPI + MongoDB (REST + WebSocket chat, orders, reviews, reports, admin, optional Gemma/ElevenLabs)
- `frontend/`: React, TypeScript, Vite, Tailwind
- `edge/uno_q/`: optional Arduino UNO Q seller assistant (Telegram/MCP)
- `docs/`: [architecture](docs/architecture.md), [API](docs/api.md), [security](docs/security.md), [setup](docs/setup.md), [Copilot workflows](docs/copilot-workflows.md)
- `.github/`: Copilot instructions, custom agents and skills for AI-assisted development

Quick start: see [docs/setup.md](docs/setup.md). Deploy checklist: [docs/deploy.md](docs/deploy.md). Submission draft: [docs/submission.md](docs/submission.md). Payments are pay-on-pickup, paid directly to the seller, or campus-wallet credits. CampusCart does not verify bank or UPI payments.

## Judge path

About two minutes, after the API is up and `python -m scripts.seed_campus_stores` has been run from `backend/`.

1. Open the site. The first screen is for the student running the stall: Gemma 4 drafts a listing from their words, and it never invents a price or publishes.
2. Log in as `caram.store@campus.test` / `CaramStore1`. In Seller Studio, choose **Run the sample note**. With `GEMMA_API_KEY` set, the listing form fills and stays a draft. Without the key, the studio says to type the listing.
3. Log out. Log in as `student.buyer@campus.test` / `CampusBuyer1`. The seed loads ₹500 of campus-wallet credit once. Open Kaaram & Ko, add garlic rice with a fried egg, check code `RICE20`, pay with the campus wallet, pick a slot, and answer hostel and spice.
4. For print, open Tanuj Prints → Document printing, upload a one-page image or PDF, add it to the cart, and check code `INKWALLET` with campus wallet. The server prices the file. Uploaded files live on the API disk, which disappears when a Render instance restarts.
5. Log back in as the Kaaram seller and accept the order on the Orders tab. Log in as Tanuj Prints (`thanooj.prints@campus.test` / `ThanoojPrint1`) and open Print queue: the packet name, the spec, and the file are on the job, with urgent jobs first.

Other seeded accounts: `thanos.brewers@campus.test` / `ThanosBrew1`, `thanooj.prints@campus.test` / `ThanoojPrint1`, and admin `desk.admin@campus.test` / `CampusDesk1`. Lending stalls, each a different student: `meera.lend@campus.test` / `MeeraLend1` (projector), `arjun.lend@campus.test` / `ArjunLend1` (speakers), `rhea.lend@campus.test` / `RheaLend1` (screwdriver kit and drill). The fee is the borrow fee. Marking a loan "Back on the shelf" makes the piece available again.

Live demo: not deployed in this repository. Fill the Render and .tech URLs in [docs/submission.md](docs/submission.md) after you follow [docs/deploy.md](docs/deploy.md).

Commits after 18 October 2026, 11:59 PM PDT: none.

License: see [LICENSE](LICENSE).
