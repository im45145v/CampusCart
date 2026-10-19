---
name: campuscart-ai-integration
description: Guides UniCart AI draft and transcription work. Use when changing listing-draft, speech-to-text, or model validation behavior.
---
# campuscart-ai-integration

Purpose
- Build or review UniCart AI-assisted listing draft and transcription features with strict grounding rules.
- Keep LLM and speech integrations safe, optional, and truthful.

When to use
- Use for `POST /api/ai/listing-draft`, `POST /api/ai/transcribe`, or related frontend flows.
- Trigger on changes in `backend/app/routers/ai.py`, `backend/app/services/llm.py`, `backend/app/services/speech.py`, or seller-facing AI UI.

Procedure
1. Preserve seller-only access for listing drafts and transcript-only behavior for speech transcription.
2. Use hosted Gemma 4 (`generateContent` when `GEMMA_API_KEY` is set). Keep `GEMMA_BASE_URL` as the OpenAI-compatible or Ollama override. `BACKBOARD_API_KEY` is the secondary text model when Gemma is unset or that call fails. Validate JSON drafts server-side. Audio stays on Gemma, then ElevenLabs.
3. Only accept price or stock if they appear in the seller's source text; return missing fields as missing.
4. Keep manual listing creation available and avoid language that implies auto-publish.
5. Add backend tests and frontend updates that reflect the true feature limits.

Expected outputs
- Safe AI service updates, validated API behavior, tests, and user-facing caveats.
- Notes for configuration or provider dependency changes.

Completion checks
- Run `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
- If seller-facing AI UX changed, also run `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
