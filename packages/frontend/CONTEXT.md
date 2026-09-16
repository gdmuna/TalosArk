# Frontend context

## Source layout

- `layout/`: application shells.
- `pages/`: route entry views. Page-owned navigation contributions live beside their page under `navigation/`.
- `modules/`: reusable product capabilities. `workspace-tabs/` owns the tab-bar UI; its state and events remain in `shared/composables/`.
- `shared/`: non-visual reusable code, including HTTP adapters, static assets, composables, utility functions, and `cn`.
- `ui/`: shadcn-vue primitives only; no TalosArk business semantics.

`App.vue`, `router/`, `main.ts`, and `style.css` remain conventional Vite entry files. Do not recreate broad top-level `app/`, `components/`, `composables/`, `events/`, `lib/`, or `utils/` directories.

## Dependency direction

`App.vue` composes `layout`, `pages`, and `modules`. `pages`, `layout`, and `modules` may use `shared` and `ui`. `ui` may depend only on `shared`. `shared` must not depend on higher layers.

## Current iteration policy

The frontend is in a rapid-iteration phase. Do not add, backfill, or maintain
test scripts unless the user explicitly requests them.

## Design SSOT

- `docs/design/design-foundation.md`: token semantics, state language, typography, and visual constraints.
- `docs/design/ux.md`: application shell, navigation, overlay, and component interaction rules.
- `src/style.css`: authoritative CSS Token values and Tailwind theme mapping.
- `color-system-preview.html`: derived visual QA only; do not treat it as a second token source.
- `DESIGN.md`: retained external Notion design analysis, not a TalosArk design authority.
