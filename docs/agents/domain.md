# Domain docs

This repository uses a multi-context domain documentation layout.

## Before exploring, read these

- `CONTEXT-MAP.md` at the repository root to identify the relevant application context
- The relevant context's `CONTEXT.md`
- Root `docs/adr/` for system-wide decisions
- The relevant context's `docs/adr/` for context-specific decisions

If a relevant context document or ADR directory does not exist, proceed silently. Do not create it preemptively; `/domain-modeling`, `/grill-with-docs`, and `/improve-codebase-architecture` create domain documentation when terminology or decisions are actually resolved.

## Use the glossary's vocabulary

When naming a domain concept in an issue title, refactor proposal, hypothesis, or test, use the wording defined in the relevant `CONTEXT.md`. If a needed concept is absent, reconsider whether the project uses another term or record the gap for `/domain-modeling`.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly instead of silently overriding it.
