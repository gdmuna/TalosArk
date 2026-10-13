# Frontend context

## Source layout

- `layout/`: application shells and cross-business composition, including the command palette, user menu and custom paged sidebar. Sidebar expansion belongs to the primary shell and is passed by props/events; sidebar-page selection belongs to `layout/sidebar/`. Business layouts do not depend on shadcn SidebarProvider or useSidebar.
- `page/`: route entry views and genuine page composition. `page/workbench/Workbench.vue` owns its tabs and RouterView; its business views live in `module/workbench/view/`. `page/management/` contains the administration skeletons and current-account settings, with private presentation helpers; it does not establish a catch-all management business module. `router/management-navigation.ts` owns their navigation descriptions and labels; `router/management.ts` assembles the statically imported pages.
- `module/`: business ownership. Each module separates business state/actions in `model/` from external I/O and data-source contracts in `data/`. Account, workspace and workbench use Pinia and mock adapters; auth uses a private, application-owned session runtime and an HTTP adapter. Module-owned UI and mature views live beside that business. Modules need not share the same state framework or have every possible subdirectory.
- `component/`: reusable functional component modules without business semantics: DataTable, Inspector, ScrollSurface, SelectField, StateBadge, breadcrumb, route-tab, view-host and view-context. Each component owns its private interaction, state and context, not just Vue files. DataTable internals are organized under `control/`, `interaction/`, `layout/` and `model/`.
- `platform/`: environment mechanisms: navigation, HTTP execution and task scheduling. HTTP owns retry, cancellation, validated response decoding and an authentication barrier; `module/auth` owns session credentials and the actual refresh adapter. Platform code never imports a business module.
- `shared/`: business-free leaves: `asset/`, `util/` and headless browser contracts. The overlay-container contract is shared by primitives and shells without depending on either.
- `ui/`: shadcn-vue primitives only; no TalosArk business semantics.

`App.vue`, `router/`, `main.ts`, and `style.css` remain conventional Vite entry files. Do not recreate broad top-level `app/`, `composable/`, `event/`, `lib/`, or `util/` directories. Generic functional components belong in `component/`; business UI belongs in its module.

Only the application composition in `bootstrap.ts` selects mock data sources through the modules' explicit `data/mock.ts` entries. Each adapter alone imports its `data/fixture.ts`. Composition creates and binds one instance per data source without fetching. Each store owns `connect(source)` and cancellable `load(signal?)`; the existing `initialize(source)` remains a convenience for connect + load. Reconnection and Pinia scope disposal invalidate pending loads, including adapters that ignore cancellation. Views consume stores, never fixtures. Local form fields, focus, open state and table-view settings remain local UI state. Provider-scoped UI contexts are registered in `ui-contexts` and disposed with their provider.

`main.ts` owns Vue/plugin installation and HTTP/auth/Pinia disposal. The small
application-owned `bootstrap.ts` coordinates required reads, not business rules or
a generic module registry. `layout/startup` owns its injected presentation context.
The desktop shell mounts before data loading; routes marked
`requiresApplicationData` show startup progress or stage-specific failure until
account -> workspace -> workbench succeeds. Public auth routes bypass this data
gate and do not initiate these reads. This route flag is not an authorization guard.
Workbench remains a main-workspace prerequisite because sidebar, command palette
and resource skeletons consume its shared snapshot; no resource HTTP contracts or
per-page data sources are invented. Future page-specific remote reads belong to
their module and actual consuming context, not this startup list.
Concurrent starts/retries share one promise, retain successful stages and reuse
sources. Recovery retries only the first unfinished stage and its successors,
never a business write or navigation registration. Navigation installs once in
main, independently of data retry. Bootstrap disposal aborts pending reads and
prevents late ready/error publication; Pinia disposal releases module resources.
See `docs/design/frontend-f12-2026-10-13.md` for scope and verification. Real
authentication/session restoration and session-change invalidation remain F13/P03,
not something implied by a ready business-data gate.

`component/view-context` owns only the generic scope registry (`register` and
its returned `dispose`). Each provider creates its own reactive state in its
actual owner: route-tab, breadcrumb or view-host. Route-tab types belong to
route-tab; the retained view-host types belong to view-host. Store ID, injection
keys and provider cleanup remain unchanged. This does not activate view-host.

Account, workspace and workbench distinguish a confirmed write from its subsequent
snapshot load. Existing string/null operation results still report only write
failure; `syncError` reports a committed write whose snapshot is not yet synchronized.
Each owner exposes `retrySync`, which runs only while synchronization is pending,
loads without replaying the write, and shares its busy guard. Stale snapshots pause
that owner's further writes, not browsing, navigation or other owners' operations.
Workspace recovery retains the newly created/joined selection unless the user
explicitly selects a different known workspace. The shell composes durable notices;
write dialogs and Inspectors also expose recovery inside their modal context.

Workbench owns one VueUse `useTimestamp` clock with an explicit one-second interval,
paused while hidden and calibrated immediately on visibility/focus recovery.
Counts, filters, badges, Inspector and relative-day labels use its time projections.
Task data identity changes at local-day/overdue boundaries to invalidate table
caches, not on every clock tick. Existing strict overdue and local-day rules remain.
Pinia scope disposal releases the clock; `main.ts` disposes Pinia on app unmount/HMR.
See `docs/design/frontend-f01-f02-2026-10-12.md` for decisions and verification.

Workbench's `OverviewData` and snapshot `overviews` contain only `recentItems`.
Current overview counts and queues derive from tasks, approvals and exceptions,
not historical dashboard fields. The unused stats, inventory-alert, equipment,
expiry and trend fields are removed from types, defaults and mock fixtures; this
does not establish a remote overview contract.

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
- `component` may use ui, shared and platform. Approved cross-component dependencies are `data-table -> inspector/scroll-surface/select-field`, `breadcrumb -> view-context`, `route-tab -> scroll-surface/view-context` and `view-host -> scroll-surface/view-context`. `view-context` does not depend on its consumers.
- `platform` may use shared. `ui` may use shared. `shared` must not depend on higher layers.
- Within a module, component or platform owner, use relative implementation imports, not its own public barrel. Consumers use explicit `index.ts` entries; module `ui/index.ts`, `route.ts` and `navigation.ts` are separate public entries. A module's own `navigation.ts` is a description implementation and may be imported relatively inside that owner. The approved cross-platform dependency is `http -> task`. Do not aggregate views or mocks into the non-visual module index.
- Module models depend on `data/source.ts`, not concrete adapters. `data/api.ts` owns endpoint paths, transport policies, response decoding and wire mappings, never local session/store writes. Where needed, a small module `factory.ts` composes an adapter with its model without taking over business rules. A private credential runtime belongs in `model/`; Pinia is used when a module owns shared observable view state, not just to make directory trees identical.
- All route components use static imports, including the workbench public `module/workbench/route.ts` entry. Do not reintroduce route lazy loading. Store IDs, provider keys, scope disposal, component APIs and business state transitions are not changed by directory migrations.

Navigation descriptions do not import Vue pages or route assembly. Management
and resource descriptions live in `router/management-navigation.ts` and
`router/resource-navigation.ts`; their neighboring route files alone import
pages. `module/workbench/navigation.ts` supplies the existing workbench paths,
labels, tab IDs and command metadata to route assembly and navigation consumers.
The sidebar and command palette consume descriptions, not route assembly.
Architecture lint guards these imports, including same-owner module descriptors.

`script/eslint-architecture.mjs`, registered in the root ESLint configuration, enforces these boundaries for resolved alias/relative imports, re-exports, type imports and dynamic imports. Missing modules remain TypeScript errors, not lint exemptions. UI generators use `shared/util/cn` and `shared/browser`, not the retired shared composables or lib trees.

## API Ownership

`platform/http` exposes the schema-validated HTTP client, authentication barrier and pagination wrapper. `platform/task` exposes abortable task scopes and an owned, non-overlapping scheduler. Business endpoints belong in `module/<owner>/data/api.ts`; `data/source.ts` describes the operations consumed by that owner's model. Route views consume business operations through the owner's public entry, not raw transport. `main.ts` composes the HTTP client and auth session and owns their disposal.

Auth follows the same responsibility layout as other modules: `data/api.ts` is a pure HTTP data source, `model/auth.ts` owns login-result ordering and local sign-out, and `model/session.ts` owns credentials and refresh validation. `model/context.ts` provides the business-operation interface to Vue. The existing `createAuthApi`, `createAuthSession`, `authApiKey` and `useAuthApi` exports are preserved; the API name denotes the public business facade, not a transport adapter with permission to mutate state.

P01 backend implements password login/activation/first-password setup, current account and Cookie refresh/logout. Public SessionCredentials contains only session/AT data, never a readable RT. Existing OIDC adapters send X-TalosArk-Client; the session model no longer reads RT expiry. Bootstrap still supplies no refresh adapter, and local sign-out does not claim server revocation. Account/workspace/workbench remain on mock sources. P03 must add real account/login/activation, startup restoration, Cookie-aware concurrency and 204/logout handling; browser/Tauri persistence is not claimed by this minimal adaptation. Do not invent resource endpoints or pagination contracts before the backend slice exists.

P02 adds real request/confirm recovery adapters and `/auth/recovery` /
`/auth/reset-password` forms. The reset form consumes the secret fragment with
router.replace before requests, keeps it only in page memory, and clears it/passwords
on completion, invalidity or unmount. Request acknowledgement never claims inbox
delivery; recovery confirms without automatic login. A successful confirm clears
local credentials only if no newer login revision has superseded it. Public auth
routes set fluidLayout for narrow screens; desktop business routes retain their
existing minimum width and application-data startup boundary. P03's broader session
and account integration is not completed by this slice. Backend design and isolated
browser/SMTP evidence live in ../backend/docs/design/mvp-p02-2026-10-13.md.

Administration skeletons use the current workspace store only for known organization/workspace identity. Other records and settings remain unloaded; counters and fields do not invent values. Write actions are disabled. Existing workspace-switcher create/join behavior is unchanged. Design-backed local views use the private `page/management/useManagementView.ts` helper and `ManagementViewNav`, with query-backed history rather than new primary routes. Personal notification preferences retain current-account context, separate from organization policy. `ManagementPage` keeps page-level navigation outside the body scroll owner, matching the workbench bar's stable height and insets. Only the body content group uses centered table, form or wide layouts; responsive inner grids use container width. Integration detail navigation stays local to its detail region. Administration navigation is not a permission boundary; authorization and real configuration loading belong to later backend-connected business slices. See `docs/design/management-skeleton.md` for scope and design references.

Account Settings is an uncategorized top management entry. Its profile and personal
notification views use the existing current-account context. Profile editing
retains `account.updateDisplayName` and its mock data source; notification writes
remain disabled until loading and API contracts exist. The header settings button
and user menu route here instead of maintaining a second profile Dialog.

The user approved removal of the unused legacy `shared/api` adapters. Their missing-schema source errors are gone, but old tests still reference retired API paths and previously removed stores/pages/schemas. Do not repair this with compatibility stubs, placeholder types, `any`, or wider compiler exclusions. See `docs/reviews/frontend-api-platform-2026-10-08.md` for the current design and verification limits; the earlier migration record remains historical.

## Current iteration policy

Resource skeletons live in `page/material`, `page/inventory` and `page/equipment`,
with object workspaces in each owner's `detail/`. `page/resource/` shares only
application-level presentation and scoped resource-summary composition; it is not
a business module or an API contract. `router/resource-navigation.ts` owns domain
descriptions; `router/resource.ts` assembles static routes. Domain tabs stay outside the body scroll owner. Object routes
use `ResourceDetailPage`: the object header and local query-backed navigation share
a full-width top region outside the body scroll owner. Each body composition sets
its intrinsic width and is centered with margins, without moving the top region.
`component/breadcrumb` combines provider-owned layers, labels and actions; the
shell renders them without inferring business routes. Resource pages provide list
return URLs, searchable active-workspace record pickers and deep-page ancestors;
local view navigation supplies the final level. `platform/navigation` remembers
the last complete URL per visited path for the current application session.
It also records an entry's origin URL, page label and browser-history position in
history state. Object-header quick returns use that origin, including after local
view changes and refresh; direct URL entries fall back to their declared parent.
List breadcrumbs remain catalog links rather than adopting the quick-return target.
Record-picker switches preserve the original entry context.
Management and resource local-view helpers use `platform/navigation`'s
`useQuerySelection`: valid switches push history, canonical duplicate selections
do nothing, and selecting the default omits its key. Invalid URL values fall back
without automatic navigation; explicitly selecting the current fallback/default
normalizes that URL with replace. Unsupported setter values are ignored. Other
query values and hash are retained. Labels and capability-dependent visibility
remain with the page, separate from one-shot entry commands.
Route pages switch immediately without whole-page fade or translation. Keyed
resource outlets replace record content and breadcrumb providers together, without
retaining an outgoing page. Sidebar, overlay and drag-reorder motion remain local
to those components.
Resource list search uses `q`, preserving other query parameters on updates.
Resource preview selection uses workbench's `useResourcePreview`: it resolves the
latest summary from the caller's resource collection in the active workspace,
clears selection on workspace/parent-context changes, resource disappearance and
caller scope disposal, and does not reopen when a removed resource returns.
ResourceDialog and ResourcePreview retain their existing Resource/null models;
material/resource lists and material-detail instance previews share the same
selection lifecycle. Preview invalidation does not mutate URL query state.
`platform/navigation` distinguishes persistent query state from one-shot commands.
Resource, task, approval, exception and storage-selection entry commands use
`useQueryCommand`: replace the current URL before executing, remove only the
consumed key, and retain other query values, hash and history metadata. Removing
a command does not close the local inspector. Workspace changes clear selection.
OIDC callbacks capture and consume `code/state` before the request, then replace
the callback entry on success. Do not replay consumed commands on Back or refresh.
DataTable identity cells open caller-supplied previews or its column-based default
Sheet. Callers own the primary detail action and route to full details when available.
Row menus include every registered action, including primary actions.
DataTable reserves three complete record rows by default (`minRows`), measured
from the first visible record and retained for the empty state. An explicit
`minHeight` is rounded up to complete rows after reserving header/footer/scrollbar
space. Empty content fills the entire record viewport. Header and footer remain
outside the vertical scroll owner.
`component/data-table/model/useTableModel.ts` owns TanStack controlled state,
filter definitions, pagination resets, selection pruning, column visibility/order
and width constraints. Controls request changes through this owner instead of
repeating column rules. Without actions, at least one business column remains
visible; with actions, all business columns may be hidden. Selection and action
columns stay visible when present; search/filter helper columns stay hidden.
Order excludes unknown, duplicate and technical IDs, and sizing uses the same
defaults and bounds as TanStack. The model also reconciles action-column removal
and changed width bounds. DOM geometry, mixed scrolling, drag motion and pointer
resize remain in their existing private owners.
Private `component/data-table/layout/geometry.ts` owns ancestor-height detection,
centered-container detection and cell-grid insets. It retains Typed OM's authored
`auto` values with inline-style fallback; resolved pixel styles are used for real
edge feedback, not to infer authored auto margins. Pointer resize retains its
bounded correction passes and centered compensation. This is not a public layout
framework or a non-Chromium compatibility guarantee.
`DataTableApi` is derived from the exposed model API, including the raw `table`
and existing mutable state. Column IDs must be unique and stable for a mounted
table; changing its schema identity requires remounting rather than silently
migrating filters, sorting and wrapping. This iteration does not introduce a
general dynamic-schema migration protocol.
See `docs/design/frontend-f05-f06-2026-10-13.md` for implementation and verification.
Only already-known
active-workspace resource summaries are displayed. Other fields stay unloaded and
write actions disabled. Professional culture/Bank/Batch skeletons do not expand
backend MVP scope. See `docs/design/resource-skeleton.md`.

Material now has only Overview and List as domain-level pages. Product branches
are Consumable, Chemical Reagent and Biological Material; Culture is a capability
within Biological Material, not a synonym for Biological Reagent or a separate
domain page. Culture and lineage navigation requires an explicit biological
material summary with `supportsCulture`; media, serum and plasmids do not receive
these entries merely because they are biological. `Resource.material` is an
optional resource-summary facet provided by the current mock adapter, not a new
backend contract or a hierarchy for the workspace's flat MaterialType. The two
material pages own their compositions and the private `useMaterialSummary`
projection. Unknown QC, activity and stock-balance fields remain unloaded. See
`docs/design/material-page-redesign.md` for naming, data and reuse boundaries.

The frontend is in a rapid-iteration phase. Do not add, backfill, or maintain
test scripts unless the user explicitly requests them.

`ui/command` owns one provider-scoped item index for registration, text/keyword
updates and removal; group visibility is derived from those entries. Dynamic
CommandItem labels supply `textValue`, including in the command palette and
resource breadcrumb picker, so filtered-out items remain searchable after updates.
DOM-text fallback preserves static callers and visible slot updates; it cannot
observe slot changes while the item DOM is absent. Explicit text avoids a native
MutationObserver. Reka continues to own keyboard navigation, selection and IME.
See `docs/design/frontend-f03-f04-2026-10-12.md` for implementation and verification.

`component/scroll-surface` owns edge decoration and keyboard-scroll clearance,
not a second scrolling engine. `edges` selects decorated sides; clearance equals
the enabled effect extent (fade `edgeSize`, line 1px, none 0) plus independent
caller-supplied `focusInset` (default 0). A number applies to all four sides; an
object selects individual sides, including undecorated ones. The command palette
sets top/bottom insets to 36 without adding matching layout padding; only its top
edge has a line decoration. Focus alignment at the list's ends is clamped by the
native scroll range, not extended with blank content space.
The command palette preserves the original scroll behavior for single navigation
keys and synchronously switches its own viewport to auto for repeated keys, before
Reka handles the event. Key release, focus loss, window blur, closing and scope
disposal restore the prior inline value and priority. Reka still owns navigation,
selection and IME; there is no input throttle or replacement scrolling engine.
`ui/scroll-area` accepts `viewportStyle`, applied only to its
own viewport; nested areas do not inherit a parent's clearance through deep CSS.
Horizontal callers still supply a horizontal ScrollBar. DataTable retains its
native-X / ScrollArea-Y composition, without ScrollSurface decoration.
See `docs/design/frontend-f07-f11-2026-10-13.md` for implementation and verification.

## Design SSOT

- `docs/design/design-foundation.md`: token semantics, state language, typography, and visual constraints.
- `docs/design/ux.md`: application shell, navigation, overlay, and component interaction rules.
- `src/style.css`: authoritative CSS Token values and Tailwind theme mapping.
- `color-system-preview.html`: derived visual QA only; do not treat it as a second token source.
- `DESIGN.md`: retained external Notion design analysis, not a TalosArk design authority.
