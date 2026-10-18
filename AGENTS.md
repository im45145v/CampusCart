# UniCart agent notes

- Start with `.github/copilot-instructions.md` for project-wide conventions, commands, domain rules, security constraints, and theme guidance.
- Use `.github/agents/` for role-specific custom agents and `.github/skills/` for repeatable UniCart workflows.
- See `docs/copilot-workflows.md` for task-to-agent and task-to-skill routing.
- When backend, frontend, edge, deployment, or security architecture changes, update these instruction files in the same change.

## Cursor Cloud specific instructions

- Login shells put Node.js 22.23.3 from `/opt/node/bin` first (`/etc/profile.d/nodepath.sh`). Run frontend commands with `bash -lc`; the image Node is older than the `jsdom`/`undici` engines and frontend tests fail on it.
- MongoDB 8 listens on `127.0.0.1:27017`. There is no systemd. If `mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok'` does not print `1`, start it with `sudo -u mongodb mongod --config /etc/mongod.conf --fork`.
- Use the project virtualenvs: `backend/.venv` and `edge/uno_q/.venv`. API: `backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`. Web: from `frontend/`, `npm run dev -- --host 0.0.0.0 --port 5173`. Health check: `GET /api/health`.
- Development defaults in `backend/app/config.py` are enough to boot. Copy `.env.example` only when overriding them, and do not commit secrets. Validation commands are listed in `.github/copilot-instructions.md`.
