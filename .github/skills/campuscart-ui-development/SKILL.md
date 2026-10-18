---
name: campuscart-ui-development
description: Guides CampusCart frontend implementation in React and Tailwind. Use when changing pages, components, routes, or UI states.
---
# campuscart-ui-development

Purpose
- Implement or refine CampusCart UI work in `frontend/` using established React, TypeScript, Tailwind, and shadcn-style patterns.
- Keep user flows aligned with actual backend guarantees.

When to use
- Use for pages, forms, route changes, component work, state display, and UX polish in `frontend/src/`.
- Trigger on buyer/seller workflow changes, listing creation, order screens, chat UI, and review flows.

Procedure
1. Locate the route, page, or component in `frontend/src/` and prefer existing primitives from `frontend/src/components/ui/`.
2. Apply the CampusCart theme: background `#F3F6F4`, cards `#FFFFFF`, primary teal `#0E6E62`, hover `#0A564C`, pine nav and headings `#12312C`, gold `#D9A441` for small highlights, text `#1C2C29`, secondary `#5D6D68`, borders `#D7E3DE`, Manrope headings, Inter body. Teal buttons use white text. Stall themes may recolor a stall’s own pages.
3. Reflect real backend constraints such as manual payment confirmation, AI draft-only behavior, and chat recovery semantics.
4. Add or update frontend tests for logic-heavy changes.
5. Record any contract mismatch that needs `backend-api-engineer` follow-up.

Expected outputs
- Updated UI components, route wiring, and tests where appropriate.
- Copy and states that match backend truth.

Completion checks
- Run `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
- If the work depends on API changes, require matching backend verification before sign-off.
