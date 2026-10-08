# Frontend context

## Source layout

- `layout/`: application shells and cross-business composition, including the command palette, user menu and custom paged sidebar. Sidebar expansion belongs to the primary shell and is passed by props/events; sidebar-page selection belongs to `layout/sidebar/`. Business layouts do not depend on shadcn SidebarProvider or useSidebar.
- `page/`: route entry views and genuine page composition. `page/workbench/Workbench.vue` owns its tabs and RouterView; its business views live in `module/workbench/view/`. `page/management/` contains the 15 first-level administration skeletons, with private presentation helpers; it does not establish a catch-all management business module. Their navigation, lazy routes and breadcrumb labels share `router/management.ts`.
- `module/`: business ownership. Each module separates business state/actions in `model/` from external I/O and data-source contracts in `data/`. Account, workspace and workbench use Pinia and mock adapters; auth uses a private, application-owned session runtime and an HTTP adapter. Module-owned UI and mature views live beside that business. Modules need not share the same state framework or have every possible subdirectory.
- `component/`: reusable functional component modules without business semantics: DataTable, Inspector, ScrollSurface, SelectField, StateBadge, route-tab, view-host and view-context. Each component owns its private interaction, state and context, not just Vue files. DataTable internals are organized under `control/`, `interaction/`, `layout/` and `model/`.
- `platform/`: environment mechanisms: navigation, HTTP execution and task scheduling. HTTP owns retry, cancellation, validated response decoding and an authentication barrier; `module/auth` owns session credentials and the actual refresh adapter. Platform code never imports a business module.
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
- Within a module, component or platform owner, use relative implementation imports, not its own public barrel. Consumers use explicit `index.ts` entries; module `ui/index.ts` and `route.ts` are separate public entries. The approved cross-platform dependency is `http -> task`. Do not aggregate views or mocks into the non-visual module index.
- Module models depend on `data/source.ts`, not concrete adapters. `data/api.ts` owns endpoint paths, transport policies, response decoding and wire mappings, never local session/store writes. Where needed, a small module `factory.ts` composes an adapter with its model without taking over business rules. A private credential runtime belongs in `model/`; Pinia is used when a module owns shared observable view state, not just to make directory trees identical.
- Keep the workbench route views lazy through `module/workbench/route.ts`. Store IDs, provider keys, scope disposal, component APIs and business state transitions are not changed by directory migrations.

`script/eslint-architecture.mjs`, registered in the root ESLint configuration, enforces these boundaries for resolved alias/relative imports, re-exports, type imports and dynamic imports. Missing modules remain TypeScript errors, not lint exemptions. UI generators use `shared/util/cn` and `shared/browser`, not the retired shared composables or lib trees.

## API Ownership

`platform/http` exposes the schema-validated HTTP client, authentication barrier and pagination wrapper. `platform/task` exposes abortable task scopes and an owned, non-overlapping scheduler. Business endpoints belong in `module/<owner>/data/api.ts`; `data/source.ts` describes the operations consumed by that owner's model. Route views consume business operations through the owner's public entry, not raw transport. `main.ts` composes the HTTP client and auth session and owns their disposal.

Auth follows the same responsibility layout as other modules: `data/api.ts` is a pure HTTP data source, `model/auth.ts` owns login-result ordering and local sign-out, and `model/session.ts` owns credentials and refresh validation. `model/context.ts` provides the business-operation interface to Vue. The existing `createAuthApi`, `createAuthSession`, `authApiKey` and `useAuthApi` exports are preserved; the API name denotes the public business facade, not a transport adapter with permission to mutate state.

Only the OIDC start/callback endpoints have a complete backend contract today. Session refresh/logout still return 501; bootstrap therefore supplies no refresh adapter, and local sign-out does not claim server-side revocation. Account/workspace/workbench remain on their existing mock data sources. Do not invent resource endpoints or pagination wire contracts before the corresponding backend slice exists.

Administration skeletons use the current workspace store only for known organization/workspace identity. Other records and settings remain unloaded; counters and fields do not invent values. Write actions are disabled. Existing workspace-switcher create/join behavior is unchanged. Design-backed local views use the private `page/management/useManagementView.ts` helper and `ManagementViewNav`, with query-backed history rather than new primary routes. Personal notification preferences retain current-account context, separate from organization policy. `ManagementPage` keeps page-level navigation outside the body scroll owner, matching the workbench bar's stable height and insets. Only the body content group uses centered table, form or wide layouts; responsive inner grids use container width. Integration detail navigation stays local to its detail region. Administration navigation is not a permission boundary; authorization and real configuration loading belong to later backend-connected business slices. See `docs/design/management-skeleton.md` for scope and design references.

The user approved removal of the unused legacy `shared/api` adapters. Their missing-schema source errors are gone, but old tests still reference retired API paths and previously removed stores/pages/schemas. Do not repair this with compatibility stubs, placeholder types, `any`, or wider compiler exclusions. See `docs/reviews/frontend-api-platform-2026-10-08.md` for the current design and verification limits; the earlier migration record remains historical.

## Current iteration policy

Resource skeletons live in `page/material`, `page/inventory` and `page/equipment`,
with object workspaces in each owner's `detail/`. `page/resource/` shares only
application-level presentation and scoped resource-summary composition; it is not
a business module or an API contract. `router/resource.ts` owns domain navigation
and lazy routes. Domain tabs stay outside the body scroll owner; object routes
instead own local query-backed views below their object header. Only already-known
active-workspace resource summaries are displayed. Other fields stay unloaded and
write actions disabled. Professional culture/Bank/Batch skeletons do not expand
backend MVP scope. See `docs/design/resource-skeleton.md`.

The frontend is in a rapid-iteration phase. Do not add, backfill, or maintain
test scripts unless the user explicitly requests them.

## Design SSOT

- `docs/design/design-foundation.md`: token semantics, state language, typography, and visual constraints.
- `docs/design/ux.md`: application shell, navigation, overlay, and component interaction rules.
- `src/style.css`: authoritative CSS Token values and Tailwind theme mapping.
- `color-system-preview.html`: derived visual QA only; do not treat it as a second token source.
- `DESIGN.md`: retained external Notion design analysis, not a TalosArk design authority.
