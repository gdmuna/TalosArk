# Frontend context

## Source layout

- `layout/`: application shells and cross-business composition, including the command palette and user menu.
- `page/`: route entry views and genuine page composition. `page/workbench/Workbench.vue` owns its tabs and RouterView; its business views live in `module/workbench/view/`.
- `module/`: business ownership. Account, workspace and workbench each own their models, stores, data-source contracts and mock adapters. Module-owned UI and mature views live beside that business.
- `component/`: reusable functional component modules without business semantics: DataTable, Inspector, ScrollSurface, SelectField, StateBadge, route-tab, view-host and view-context. Each component owns its private interaction, state and context, not just Vue files. DataTable internals are organized under `control/`, `interaction/`, `layout/` and `model/`.
- `platform/`: environment mechanisms, currently browser navigation and route matching. Do not move authentication policy into a nominally generic HTTP mechanism.
- `shared/`: business-free leaves: `asset/`, `util/` and headless browser contracts. The overlay-container contract is shared by primitives and shells without depending on either.
- `ui/`: shadcn-vue primitives only; no TalosArk business semantics.

`App.vue`, `router/`, `main.ts`, and `style.css` remain conventional Vite entry files. Do not recreate broad top-level `app/`, `composable/`, `event/`, `lib/`, or `util/` directories. Generic functional components belong in `component/`; business UI belongs in its module.

Only `main.ts` selects mock data sources through the modules' explicit `data/mock.ts` entries. Each adapter alone imports its `data/fixture.ts`. Bootstrap creates one instance per data source and initializes account, workspace and workbench in the existing order. Views consume stores, never fixtures. Local form fields, focus, open state and table-view settings remain local UI state. Provider-scoped UI contexts are registered in `ui-contexts` and disposed with their provider.

## Singular naming

Use singular names for owned directories and files, describing their responsibility rather than the number of things they contain: `module/`, `component/`, `page/`, `view/`, `control/`, `asset/font/`, `util/`, `script/`, `type.ts`, `variant.ts`, `fixture.ts` and `route.ts`. Name compound files by their role, such as `DataTableFilterMenu.vue` and `DataTableBulkActionMenu.vue`.

This convention does not change collection semantics in variables, exported symbols, component props, events, data fields or API contracts. Keep names such as `rows`, `filters`, `selectedRows` and `workbenchRoutes` when they describe collections.

Exceptions:

- `docs/` is excluded from this naming migration, including its contents and historical path references.
- Published `public/` resource paths, including `icons/` and `images/`, remain stable URL contracts.
- Tool-defined names remain unchanged: `components.json` and its alias keys, Tauri `src-tauri/capabilities/` and `src-tauri/icons/`, and package/build configuration filenames.
- Dependency, generated and report directories are not application namespaces and are not renamed.

Update imports, generator alias values and architecture rules together when moving owned paths. Do not infer naming violations from a trailing `s` alone.

## Dependency direction

- `main`, `App`, `router`, `layout` and `page` compose module and component public entries, platform, shared and ui.
- `module` may use component, platform, shared and ui. The approved cross-business dependency is `workbench -> workspace`, through the workspace public entry.
- `component` may use ui, shared and platform. Approved cross-component dependencies are `data-table -> scroll-surface/select-field`, `route-tab -> scroll-surface/view-context` and `view-host -> scroll-surface/view-context`. `view-context` does not depend on its consumers.
- `platform` may use shared. `ui` may use shared. `shared` must not depend on higher layers.
- Within a module or component, use relative implementation imports, not its own public barrel. Consumers use explicit `index.ts` entries; module `ui/index.ts` and `route.ts` are separate public entries. Do not aggregate views or mocks into the non-visual module index.
- Keep the workbench route views lazy through `module/workbench/route.ts`. Store IDs, provider keys, scope disposal, component APIs and business state transitions are not changed by directory migrations.

`script/eslint-architecture.mjs`, registered in the root ESLint configuration, enforces these boundaries for resolved alias/relative imports, re-exports, type imports and dynamic imports. Missing modules remain TypeScript errors, not lint exemptions. UI generators use `shared/util/cn` and `shared/browser`, not the retired shared composables or lib trees.

## Legacy API Boundary

`src/shared/api/` is a named transitional exception to the business-free shared layout, not an example for new code. Its HTTP client, token refresh and legacy adapters remain together until the backend authentication and resource contracts are confirmed. Auth route views still use the existing client; its 401 and original-request error behavior is unchanged.

The adapters `auth`, `box-image`, `box`, `feedback`, `node`, `org-user`, `org`, `reagent` and `user` still reference removed schemas. Old tests also reference removed stores/pages/schemas. These pre-existing type-check failures are not repaired with placeholder types, `any`, restored old business models or widened compiler exclusions. Retirement or contract replacement requires separate approval before this exception can be removed. See `docs/reviews/frontend-structure-refactor-2026-10-05.md` for the migration and verification record.

## Current iteration policy

The frontend is in a rapid-iteration phase. Do not add, backfill, or maintain
test scripts unless the user explicitly requests them.

## Design SSOT

- `docs/design/design-foundation.md`: token semantics, state language, typography, and visual constraints.
- `docs/design/ux.md`: application shell, navigation, overlay, and component interaction rules.
- `src/style.css`: authoritative CSS Token values and Tailwind theme mapping.
- `color-system-preview.html`: derived visual QA only; do not treat it as a second token source.
- `DESIGN.md`: retained external Notion design analysis, not a TalosArk design authority.
