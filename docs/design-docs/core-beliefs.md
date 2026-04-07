# Core Development Beliefs -- Tarmeer 4.0

These beliefs guide how we build, operate, and evolve the Tarmeer platform. They are not aspirational; they are enforced through tooling, documentation structure, and incident response.

---

## Agent-First Development

The codebase is the single source of truth. If something is not in the repo, it does not exist for the agent.

- All architectural decisions, constraints, and domain knowledge must live in repo markdown files.
- Configuration that affects behavior belongs in code or config files, never in tribal knowledge or chat history.
- The agent should be able to onboard from the repo alone, with no external briefing required.

## Knowledge Management

CLAUDE.md is a table of contents, not an encyclopedia.

- CLAUDE.md contains rules and pointers. It stays concise and scannable.
- Deep knowledge lives in `docs/` with proper structure: design docs, incident logs, operation guides.
- Progressive disclosure: start with the rule in CLAUDE.md, link to the full explanation in `docs/`.
- When a topic grows beyond a few lines in CLAUDE.md, extract it into its own document and leave a pointer.

## Reliability Over Speed

We do not trade correctness for velocity.

- Never deploy without verifying the deployment checklist (see CLAUDE.md / project memory).
- Every production incident produces a concrete rule in `docs/RELIABILITY.md`.
- Rules are enforced mechanically wherever possible. Preference order: **code enforcement > documentation > memory**.
- A guardrail in code (validation, type check, lint rule) is worth more than ten lines of documentation.
- When a rule can only be documented, it goes into CLAUDE.md so the agent sees it on every session.

## Design Consistency

All UI follows `docs/DESIGN.md` and the global design tokens in `src/index.css`.

- No local overrides of global design tokens (colors, radii, font sizes).
- Component patterns are documented once and reused everywhere.
- New pages copy the established input/button/card patterns rather than inventing new ones.
- Visual consistency is verified through design review before deploy.

## Continuous Learning

Mistakes are the raw material for reliability.

- Every incident is recorded in `docs/incident-log/` with root cause, fix, and timeline.
- Each root cause becomes a rule in `docs/RELIABILITY.md` or `docs/SECURITY.md`.
- Rules accumulate over time. The system gets harder to break with each incident.
- We never blame; we always ask "what rule would have prevented this?" and then add that rule.

---

## Summary

| Belief | Enforcement |
|--------|-------------|
| Codebase is the source of truth | All knowledge in repo markdown |
| CLAUDE.md is a TOC | Deep docs in `docs/`, pointers in CLAUDE.md |
| Reliability over speed | Deployment checklist, RELIABILITY.md rules |
| Design consistency | Global tokens in `src/index.css`, DESIGN.md |
| Continuous learning | Incident logs produce reliability rules |
