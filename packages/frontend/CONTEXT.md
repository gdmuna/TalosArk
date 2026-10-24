# Frontend context

## Source layout

- `layout/`: application shells and cross-business composition, including the command palette, user menu and custom paged sidebar. Sidebar expansion is an application-local preference provided by the root desktop shell through `layout/application-setting`, retaining the existing cookie; content shells receive it by props/events. Sidebar-page selection belongs to `layout/sidebar/`. Business layouts do not depend on shadcn SidebarProvider or useSidebar.
- `page/`: route entry views and genuine page composition. `page/workbench/Workbench.vue` owns its tabs and RouterView; its business views live in `module/workbench/view/`. `page/management/` contains the administration skeletons and current-account settings, with private presentation helpers; it does not establish a catch-all management business module. `router/management-navigation.ts` owns their navigation descriptions and labels; `router/management.ts` assembles the statically imported pages.
- `module/`: business ownership. Each module separates business state/actions in `model/` from external I/O and data-source contracts in `data/`. Account and workspace use Pinia and real HTTP readers. Retained workspace/workbench mock adapters are not selected by default. Auth uses a private, application-owned session runtime and an HTTP adapter. Module-owned UI and mature views live beside that business. Modules need not share the same state framework or have every possible subdirectory.
- `component/`: reusable functional component modules without business semantics: DataTable, Inspector, ScrollSurface, SelectField, StateBadge, breadcrumb, route-tab, view-host and view-context. Each component owns its private interaction, state and context, not just Vue files. DataTable internals are organized under `control/`, `interaction/`, `layout/` and `model/`.
- `platform/`: environment mechanisms: navigation, HTTP execution and task scheduling. HTTP owns retry, cancellation, validated response decoding and an authentication barrier; `module/auth` owns session credentials and the actual refresh adapter. Platform code never imports a business module.
- `shared/`: business-free leaves: `asset/`, `util/` and headless browser contracts. The overlay-container contract is shared by primitives and shells without depending on either.
- `ui/`: shadcn-vue primitives only; no TalosArk business semantics.

`App.vue`, `router/`, `main.ts`, and `style.css` remain conventional Vite entry files. Do not recreate broad top-level `app/`, `composable/`, `event/`, `lib/`, or `util/` directories. Generic functional components belong in `component/`; business UI belongs in its module.

Business codes are optional user labels and may remain null. Forms neither require
them nor promise automatic numbering. Facts show an unfilled value; titles, pickers,
grid cells and approval rows use existing names/physical labels when codes are
absent. Missing codes never mean restricted access and are not replaced with UUIDs.
Grid generation only assigns position codes when the user supplies a code prefix.

R04-A1 adds the independent `module/audit` read-source contract and cancellable
reader. No production audit source is registered until public read/authorization
contracts exist; missing sources show unavailable, never fixture fallback. Audit
pages own scope/filter/cursor URL state, Inspector and standalone detail composition.
They do not reuse team activity as organization audit or expose raw event details.
The cursor footer reports batch size, not total/page counts. Scope/account/query
changes cancel and clear reads; authorization failures clear records, while same-scope
temporary failures may retain explicitly stale results. Resource snapshots remain
non-navigable until current read capability is confirmed. See remediation R04.

R04-B adds the independent optional `module/organization` read source for profile
facts and explicitly measured active-member/pending-invitation counts. It does not
register a production source before public contracts exist. Management Overview
and Organization Settings retain real directory name/ID and accessible-workspace
facts, never derive organization totals from team pages, and do not select fixtures
on missing sources or failures. Their local organization query does not switch the
global workspace. Scope/account changes clear reads and cancel late results;
authorization/protocol failures clear sensitive results, while temporary failures
retain explicitly stale same-scope results. Name editing and lifecycle commands
remain deferred. Recent organization audit consumes the separate audit owner.
Workspace-list organization filters round-trip through the URL, including `all`.
See remediation R04's organization acceptance and read-contract handoff.

R04-C adds optional resource-access and sharing-policy read sources under
`module/resource-access`, not a frontend permission engine or a new backend
authorization model. Production registers neither source. Management pages own
local organization/workspace/query state, independent grant Inspector reads and
Resource-ID detail tabs. Source-projected basis/status/expiry/policy fields remain
consumer proposals until public contracts exist; no grant, revoke or policy-save
commands are exposed. Resource identity and content IDs stay distinct; content
links require an explicit readable reference in the active workspace. Scope/account
changes cancel and clear reads, temporary failures retain labelled stale data,
and authentication/authorization/protocol failures clear it. Remote DataTable mode
offers only explicitly registered filter fields; local column inference is unchanged.
See remediation R04's resource-access contract and acceptance records.

P08 supersedes R04-D's optional basic facility projection. `module/facility/data`
owns the production HTTP adapter and public-schema decoding, including response
identity and pagination validation. `main.ts` registers it without fetching. Each
facility has one current topology; module-owned UI shares lazy trees, bounded
list/grid browsing, authorized position selection and revisioned structure forms
between governance and inventory pages. Organization-owned facilities, management
workspaces, whole-facility USE/MANAGE relations and inventory-content access remain
distinct. Facility governance uses server `govern`; structure maintenance uses
`manage`. Workspace reads and node commands carry an explicit workspace context.
Pages own URL scope and selection; facility and node deep links read independently
of list/tree loading. Cursor append retains its snapshot and topology revision;
query/scope changes and security/protocol failures clear snapshots and cursors.
Reads and writes ignore canceled late completions. 409 keeps the form draft but
blocks submission until explicit reload. Confirmed writes whose reload fails show
the shared sync notice and recover by reading only, never by replaying the command.
Sparse grids draw registered coordinates, not implied available positions. Batch
generation submits at most 1000 explicit one-based positions; reorder uses an
adjacent anchor; empty-subtree moves carry both revisions and retain node IDs.
Rules/templates remain optional readonly consumer projections with no production
source. Audit, equipment links, Placement and occupied-subtree movement are not
provided by this slice. No silent workspace activation occurs. See the P08 frontend
acceptance and current contract handoff under remediation R04.

Application composition selects data sources explicitly. `main.ts` supplies the real account and workspace readers; `bootstrap.ts` has no mock fallback. Retained mock adapters stay behind their explicit `data/mock.ts` entries and alone import fixtures. Composition binds sources without fetching. Each store owns `connect(source)`, cancellable `load(signal?)` and session-change `reset()`; `initialize(source)` remains connect + load. Reset/reconnection/disposal invalidate pending reads, including ignored cancellation, and prevent old mutation/synchronization results from changing a newer context. Views consume stores, never fixtures. Local form fields, focus, open state and table-view settings remain local UI state. Provider-scoped UI contexts are registered in `ui-contexts` and disposed with their provider.

`main.ts` owns Vue/plugin installation and HTTP/auth/Pinia disposal. The small
application-owned `bootstrap.ts` coordinates required reads, not business rules or
a generic module registry. `layout/startup` owns its injected presentation context.
The desktop shell mounts before data loading; routes marked
`requiresApplicationData` show startup progress or stage-specific failure until
session -> account -> configured workspace/workbench reads succeed. Startup feedback
uses the available window width; the desktop minimum applies only to business views.
Public auth
routes bypass this data gate and do not initiate these reads. Authentication is a
separate route requirement. P04 selects real account and workspace readers;
workbench's legacy queue snapshot remains unloaded without an explicit reader.
R10's production overview instead composes the existing material overview, inventory
list and workspace-scoped facility list through `WorkbenchOverviewDataSource`.
These three reads run on overview mount, independently of startup and one another;
missing queues alone show unavailable, never fake zero statistics. Each section
clears and cancels on scope changes, retry and disposal, rejecting late completions.
Material counts use `active`; inventory and facility counts use the server's `total`,
not the displayed page size. Material overview validates the scope of recent records.
Facility links enter workspace-scoped storage browsing rather than organization
governance. No production mock is registered. See remediation R10 for evidence and
the remaining P12/P15/P16 queue dependencies. A workspace-unavailable view allows first organization
creation. Account Settings and Workspace management remain accessible without
an active workspace. No resource HTTP contracts or per-page data sources are
invented; future remote reads belong to their module and consuming context.
Concurrent starts/retries share one promise, retain successful stages and reuse
sources. Recovery retries only the first unfinished stage and its successors,
never a business write or navigation registration. Navigation installs once in
main, independently of data retry. Bootstrap disposal aborts pending reads and
prevents late ready/error publication; Pinia disposal releases module resources.
F12's original scope and verification remain in docs/design/frontend-f12-2026-10-13.md.
P03 adds real restoration and session-change invalidation; its Web evidence and
Tauri/production limits live in docs/design/mvp-p03-2026-10-14.md.

P12 now supplies real approval queues and summary through module/approval;
ordinary tasks and notification/reminder sources still await their own slices.
Approval owns its public-schema HTTP adapter, cancellable scoped reads, session-
owned original command journal and module UI. Workbench composes its UI/queries,
never its lifecycle. Review loads every detail page before a complete explicit
decision; display pagination is not a business item limit. Granted execution is
one line at a time. Unknown outcomes preserve original body/key; known successful
commands recover with reads only until synchronization succeeds. Account changes
clear ownership and late scope results cannot change a new page. Approval URLs
carry organization/workspace; the shell validates them against the authorized
directory and server context before mounting views, not as local authorization.
The inventory module exports its existing position picker for receipt, direct
actions and approval forms. See docs/design/mvp-p12-2026-10-20.md and the product
joint acceptance record; Tauri and production are not covered by local Web proof.

P13 composes the existing receipt and approval commands into client batches,
without new backend bulk routes or a second permission/stock engine. The reusable
`component/batch-operation` owns sequential dispatch, per-unit outcomes and the
account-owned tab-session journal; business Stores supply schemas, rejection
classification, sends and receipt reads. Each batch has at most 100 physical
items, approval requests or approved lines, never a new limit on a single P12
request's lines. Cross-request review loads every line before confirmation;
mixed line decisions stay in the original detail. Receipt staging reuses the
single-item form and position picker, with no pre-confirmation inventory writes.
Known rejection continues to other units; uncertainty pauses and preserves the
exact scope/body/key. Known success recovers by reads only. Synchronization owns
the whole receipt-and-page refresh phase; obsolete completions cannot clear the
journal. Temporary sync errors belong to one batch, not another workspace.
Account changes clear ownership, scope changes cancel, and returning requires
explicit continuation. Unsubmitted drafts are memory-only; confirmed intents
survive same-tab reload, not closed tabs or cleared storage. See
`../../docs/product/mvp-p13-2026-10-22.md` for local Web/HTTP/database evidence.

P04's workspace HTTP adapter uses contracts/team and validates a selected tenant/
workspace pair on the server before publishing it. It never treats local selection
or canCreateWorkspace as authorization. Context changes invalidate old workspace
and workbench operations. Explicit selection may replace pendingSelection but
cannot clear syncError; only a completed full snapshot synchronization clears it.
WorkspaceCreateDialog owns form generations so late results cannot affect a
reopened form. The real source does not enable invitation-code joining; retained
mock joining remains behind its explicit source. Evidence and P05/P06 limits are
in ../backend/docs/design/mvp-p04-2026-10-15.md.

P06 connects real team management through the workspace owner: data/team-api.ts
owns transport, model/team-store.ts owns scoped reads/mutations, and TeamManagement
composes the member/role pages. Failed reads after a confirmed write pause further
writes; a committed leave clears the old member view and recovers by reading the
workspace snapshot, never replaying leave. Invitation intent is memory-only across
SPA password login. The public invitation page removes its fragment, binds preview
and acceptance to token/identity generations and requires explicit acceptance.
Full reload or external SSO requires reopening the original mail link after login.
No mock organization binding, remote workbench reader or node authorization is added.

R02 keeps member/invitation search and pagination on the server. The team store
records `appliedSearch` only with a successful snapshot; pagination restores that
snapshot's capacity/search instead of mixing in a failed request. Explicit reload
alone retries the failed query. Role search and scope filtering apply locally to
the complete authorized role catalog. The optional read-only matrix displays
returned role definitions, not a member's effective authorization. Shared private
team UI owns row menus and searchable permission selection; original role bindings
remain removable even when the role cannot be newly granted.

Standalone member/role route pages own restorable list state in their URL:
organization/workspace, submitted search, page/capacity, member/invitation tab,
and role scope/list-matrix view. Their private query adapter uses replace and
preserves unrelated query values and hash. TeamManagement accepts controlled
list state; its search draft and dialogs stay local. Team selection receives
the restored query before its first read. Embedded workspace details retain
their fixed scope and local list state, independently of the surrounding URL.
Management activity clears accumulated rows and cursors on explicit 401/403/404,
retains successful pages on temporary read failures, and ignores obsolete errors.

Management Workspace's organization filter is local to that list, not a global
workspace switch. Previews use only known snapshot fields. Entering a different
workspace still requires a successful server selection; creation prefers the
list's selected organization. R02 adds no object-detail contracts or routes.
See `docs/remediation/2026-10-15/r02/README.md` for real read-only and isolated
verification, remaining contract gaps and acceptance limits.

R03 keeps the explicit Mock detail routes for workspace, organization membership
and role as a review-only prototype, but production management details now use
real HTTP sources and real IDs. Real management lists no longer expose a Mock
detail action; bootstrap and production readers never silently select fixtures.
`module/workspace/prototype.ts` is a separate public entry selected only by
`page/management/detail/prototype.ts`. Detail fixtures are imported only by their
mock adapter. They are not aggregated into the ordinary module index.
`createTeamManagementState` keeps the existing team behavior shared by the real
Pinia store and a locally owned prototype instance. Embedded member/role views
pin their explicit organization/workspace scope, not the global active workspace.
OrganizationMember, WorkspaceMember and User IDs stay distinct. Detail-page
headers and local navigation remain full width; only the body is centered and
limited to 1280px of content. Quick returns read reactive navigation origins;
same-kind object pickers preserve the entry source. Discarding a confirmed draft
restores its values, not merely bypassing the navigation guard.
Facility sharing means FacilityWorkspaceAccess, not generic sharing or expiry.
Resource-created charts count createdAt in an explicit fixture date window, not
usage. Member role-source views are not effective authorization evaluators. Role
matrices use only existing registered definitions and do not add inheritance.
Mock edits are memory-only and reset on reload; protection/read-only flags in the
prototype are simulation scenarios, not server authorization proof. The real
pages use independently paginated relationships and activity, server capability
projections, `updatedAt` conflict checks, and explicit “未接入” states for
facilities, inventory and equipment. See `docs/remediation/2026-10-15/r03/README.md`
for the historical schema mapping and the dated real-integration boundary.

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
- `module` may use component, platform, shared and ui. Approved cross-business dependencies are `workbench -> workspace`, `material -> workspace` and `inventory -> workspace`, through the workspace public entry. Material and inventory only use that owner for the current workspace context. Receipt and role-setup composition across inventory/material/facility/team belongs to `page/inventory/component`, not extra cross-module dependency exemptions.
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

Auth follows the same responsibility layout as other modules: `data/api.ts` is a pure HTTP data source, `model/auth.ts` owns login-result ordering and server/local sign-out, and `model/session.ts` owns in-memory credentials and restoration/refresh validation. `model/browser-session.ts` owns Cookie-operation coordination and a credential-free persistent sign-out marker. `model/context.ts` provides the business interface to Vue. `createAuthApi`, `createAuthSession`, `authApiKey` and `useAuthApi` remain the public entries; createAuthApi now also requires the API root for coordination. The API name denotes the public business facade, not a transport adapter with permission to mutate state.

P03 connects password login, activation, first-password setup, OIDC, real current account and Cookie refresh/logout. Public SessionCredentials contains only session/AT data, never a readable RT; AT remains in memory. Cookie writes use one same-origin Web Lock, and storage events invalidate old account/workspace/workbench snapshots. Persistent browser storage contains only a coordination revision and sign-out/confirmation flags. Network-failed logout still clears local state, reports unconfirmed server revocation and suppresses automatic restoration across reload/reopen until explicit login. Cold restoration, invalid credentials, network failure and 403 remain distinct. Only confirmed anonymous sessions redirect protected entries to login. Restoration error keeps the protected URL and uses ApplicationStartup's failure/retry view without clearing Cookie or marking sign-out; manual retry retains query/hash and proceeds with remaining reads. Login has no duplicate restoration message/button; password/SSO errors and sign-out notices remain local feedback. Explicit public login does not automatically restore a session. Full-screen startup loading/error views use muted, matching the custom titlebar. The HTTP decoder accepts only explicitly declared empty 204 responses; JSON envelope/schema checks otherwise remain strict. Web browser-process persistence is verified; Tauri, cross-site hosting, different frontend origins and real Casdoor/provider delivery are not. Do not invent resource endpoints or pagination contracts before their slice exists.

R08-A shares AuthPage and the Field-based PasswordForm across authentication pages.
The auth shell owns vertical overflow without scrolling the titlebar. Local-password
login and recovery retain a validated internal next path. OIDC adds a separate,
tab-scoped sessionStorage record containing only its state and return path; the
callback matches and consumes it once, never stores code or session credentials.
Invitation tokens remain SPA-memory-only, with explicit reloading or account
switching after failure. A confirmed acceptance recovers its directory by reads
only, never by replaying accept. First-password eligibility still comes from the
existing command response, not inferred profile data. R08-A isolated Web evidence
and outstanding real-provider/platform checks are recorded under remediation/r08.

P02 adds real request/confirm recovery adapters and `/auth/recovery` /
`/auth/reset-password` forms. The reset form consumes the secret fragment with
router.replace before requests, keeps it only in page memory, and clears it/passwords
on completion, invalidity or unmount. Request acknowledgement never claims inbox
delivery; recovery confirms without automatic login. A successful confirm clears
local credentials only if no newer login revision has superseded it. Public auth
routes set fluidLayout for narrow screens; desktop business routes retain their
existing minimum width and application-data startup boundary. This remains P02's
recovery scope, not a claim about every auth flow. P03 now coordinates its Cookie
clearing with login/refresh/logout. P02's isolated evidence remains in
../backend/docs/design/mvp-p02-2026-10-13.md.

Administration skeletons use the current workspace store only for known organization/workspace identity. Other records and settings remain unloaded; counters and fields do not invent values. Write actions are disabled. Existing workspace-switcher create/join behavior is unchanged. Design-backed local views use the private `page/management/useManagementView.ts` helper and `ManagementViewNav`, with query-backed history rather than new primary routes. Personal notification preferences retain current-account context, separate from organization policy. `ManagementPage` keeps page-level navigation outside the body scroll owner, matching the workbench bar's stable height and insets. Only the body content group uses centered table, form or wide layouts; responsive inner grids use container width. Integration detail navigation stays local to its detail region. Administration navigation is not a permission boundary; authorization and real configuration loading belong to later backend-connected business slices. See `docs/design/management-skeleton.md` for scope and design references.

Account Settings is an uncategorized top management entry. Its profile and personal
notification views use the real current-account context. Profile editing retains
the optional `account.updateDisplayName` data-source capability, but real-source
profile writes and notification writes remain disabled until their API contracts
exist. The account page links to authenticated first-password setup. The user menu
routes here instead of maintaining a second profile Dialog; the adjacent settings
icon opens Application Settings, not Account Settings. R08-B
renders readonly profile facts when the optional write source is absent. Editable
sources retain draft guards and read-only synchronization recovery, clearing drafts
on account-ID changes even when display names match. Normal synchronization errors
use the shell notice once; silent pending recovery remains available on the page.

R08-B's application-setting layout context owns one local preference/help/about
Dialog, shared by the anonymous titlebar, authenticated settings/help buttons,
the user menu's About item and the command palette. The user menu has no separate
Application Settings item.
It stores no account/business state and adds no generic settings registry. Public
unmatched routes use the statically imported NotFound page without protected data
reads. Workspace switching keeps its original anchor, explicit server selection and
scoped cancellation; empty organizations are not hidden by search projection.
The command palette labels unavailable resource search separately from no matches,
preserves its focusInset and repeat-key scrolling, and ignores IME Enter. A file
projection without an explicit material parent has no invented device/download
link. Display-only Button tooltips are pointer-transparent through their Popper
wrapper and unmount immediately on close, releasing their Escape layer; custom
Tooltip content remains unchanged. See remediation/r08 for acceptance boundaries.

R08-C uses SheetInspector for the legacy search resource preview as well; an
explicit return-focus target supports command-palette handoff. DialogContent's
default height and center respect the shared titlebar inset and bound long content
to an internally scrollable viewport. Existing customized layouts, Portal order
and transitions remain intact. `component/overlay-draft` protects unsent inputs in
business editors against dismissal, navigation and unload; it captures initialized
defaults after opening, and defers disposal until all navigation guards accept.
Callers explicitly distinguish busy forms from commands already journaled or
committed. Business owners retain cancellation, batch pause and read-only recovery;
the draft helper never stores or replays a business command. P13 batch overlays
show their explicit operation workspace without switching global context. G-12's
object/action-qualified workspace candidates are not inferred from the directory;
that contract and composite date filtering remain dependencies. See the R08-C
acceptance record for isolated evidence and unverified platform/real-write gates.

The user approved removal of the unused legacy `shared/api` adapters. Their missing-schema source errors are gone, but old tests still reference retired API paths and previously removed stores/pages/schemas. Do not repair this with compatibility stubs, placeholder types, `any`, or wider compiler exclusions. See `docs/reviews/frontend-api-platform-2026-10-08.md` for the current design and verification limits; the earlier migration record remains historical.

R04-E adds the optional notification-policy read source under `module/notification`.
Production registers no source or fixture fallback. Event and severity-delivery
matrices display source-projected recipients, enforcement and channel availability;
they are not a notification engine or an approved policy model. The finite label
catalog follows the five current Prisma NotificationType values, retaining unknown
codes without generating default rules. Account/scope/view changes clear and cancel
reads, late results cannot publish, temporary errors label retained stale results,
and authentication/authorization/protocol failures clear them. Personal settings
reuse one shared unavailable-state component until an account preference contract
exists. No policy save, test-send or personal write is exposed. See R04's notification
read-contract handoff and isolated acceptance for P16 and delivery limits.

R04-F adds optional readonly integration sources under `module/integration`,
organization-policy reads under `module/organization`, and allowlisted deployment
information under `module/deployment`. Production registers none. Integration
catalogs, details and cursor logs remain independently scoped; switching account,
organization, integration or view clears obsolete reads, and ignored cancellation
cannot publish late data. Protocol/authentication/authorization failures clear
snapshots; temporary same-context errors label stale results. Structured projections
exclude arbitrary configuration, credentials, raw vendor payloads and exceptions.
Organization governance never edits deployment defaults or computes effective
permissions. Personal settings only link to their existing owner. No save, test,
synchronize or secret-reset command is exposed. See R04's integration/settings
contract and isolated acceptance for production limits.

## Current iteration policy

Resource skeletons live in `page/material`, `page/inventory` and `page/equipment`,
with object workspaces in each owner's `detail/`. `page/resource/` shares only
application-level presentation and scoped resource-summary composition; it is not
a business module or an API contract. `router/resource-navigation.ts` owns domain
descriptions; `router/resource.ts` assembles static routes. Domain tabs stay outside the body scroll owner. Object routes
use `ResourceDetailPage`: the full-width object header, summary and local query-backed
navigation scroll together with the body. Management object details follow the
same rule; domain-level page tabs remain outside the body scroll owner. Table/data
list canvases shrink-wrap their content with auto margins and a viewport-relative
maximum, not a fixed pixel cap. Their shrink-wrapping wrapper is not an inline-size
query container. Tool workspaces (including the query-container-based team UI)
and table-bearing object details also have no fixed maximum width, but retain
their fluid grid layouts.
Ordinary overview/read canvases remain capped at 1200px and single forms at 720px.
Page canvases do not shrink with
table columns or row counts; fixed/manual table widths remain independent and
start at the canvas's left edge. Body padding is 16px, or 24px from desktop lg.
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
query values and hash are retained. An optional query patch lets a real view switch
clear dependent cursors in the same navigation; it cannot override the selected
key and does not turn an already canonical duplicate into a navigation.
Labels and capability-dependent visibility
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
ResourceDialog and ResourcePreview retain their existing Resource/null models.
The real P07 material pages instead own material-ID detail reads with the same
workspace-change/disposal invalidation boundary. Preview invalidation does not
mutate URL query state.
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
DataTable's canvas remains full width, while its toolbar follows the actual frame
width: below 600px, search takes a deliberate second full-width row. Callers may
explicitly mark a name/description column with `fill`; the first visible marked
column takes remaining canvas width within its bounds. Other columns remain fixed.
Any manual resize freezes the current automatic fill width so a preceding fill
column cannot absorb the pointer movement. Explicit sizing wins until that fill
column's sizing is cleared. The model accepts a measured numeric available width;
DOM measurement stays in DataTable. Pagination
responds to the frame width, grouping total/page size and page number/navigation;
very narrow frames use a compact vertical arrangement without stretching columns.
Detail main/aside composition becomes single-column below 1000px of body width;
internal fact lists independently use two columns from 640px. Management Overview
uses compact summary links and a 2:1 main/aside composition. Workspace identity
and TeamManagement presentation use existing fields only; server queries,
commands, permissions and production data sources remain unchanged.
See `docs/remediation/2026-10-15/r01/revision/README.md` for revised R01 evidence
and open gates; the parent R01 record preserves the first-round baseline.
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

Material has only Overview and List as domain-level pages, plus deep-link detail.
P07's `module/material` owns its real typed HTTP source, workspace-scoped store,
cancellable reads, revisions and Sheet editor/classification manager. Production
material pages do not use workbench mocks or infer branch facts from names.
Branches are Consumable, Chemical Material and Biological Material, each with a
finite optional attribute set. Flat classifications are separate from branches.
List search/filter/sort/page run on the server; DataTable's optional serverTotal
selects manual processing without changing local callers. Preview reads by ID,
independently of the current page, and detail editing keeps a stable snapshot.
Creation query commands are consumed once. No instance, inventory, attachment,
QC, culture or lineage workflow is claimed by this slice; unknown data stays
explicitly unintegrated. See `../backend/docs/design/mvp-p07-2026-10-18.md` and the
dated override in `docs/design/material-page-redesign.md` for current boundaries.

P09 adds a production `module/inventory` HTTP source, scoped cancellable readers,
facts-correction UI, and independent stock/transaction reads. Material
owns source-batch CRUD and quantity precision; facility owns usable position
candidates. Pages compose these owners without fixture fallback. Receipt retries
retain the exact original scope, body and idempotency key after uncertain outcomes;
confirmed writes whose reload fails recover by reading only. Server business dates
govern expiry confirmation. Old organizations receive an explicit owner-confirmed
inventory-role setup entry, never an automatic permission write on page load.
Stock/transaction/batch responses validate identity and pagination. Unsupported
server sorting, inferred filters and invented alert totals are not offered.
Unconfirmed receipts belong to inventory's Pinia owner and account-keyed tab-session
storage, retaining exact scope/body/key through navigation and same-tab reload.
The page-private position picker owns facility/cursor UI. Material reader refreshes
join an active request after revision invalidation; batch editors explicitly recover
latest facts after conflicts. Cell Bank and its professional Batch retain separate
skeletons from the ordinary source-batch workspace.
P09's occupied-container relocation is composed in `page/inventory/component`,
reused by storage browsing, facility detail and storage governance. Facility's
browser offers only a node-action slot; inventory does not import facility.
The inventory adapter validates the existing preview/execute/operation contracts.
Its relocation store persists the exact command and receipt per account/tab,
not the sensitive impact item list. UI changes invalidate the impact confirmation;
unknown outcomes retain the original key, confirmed outcomes recover with GET only.
The Web receive/relocation and recovery evidence, and the unverified multi-workspace,
Tauri and deployment boundaries, are recorded in
`../../docs/product/mvp-p09-p10-acceptance-2026-10-20.md` and
`../../docs/product/mvp-p09-relocation-acceptance-2026-10-20.md`.

P11 adds real consume/transfer/adjust/dispose commands to ledger row actions and
stock detail. Per-stock server actions determine availability; pages compose the
facility position picker without an inventory-to-facility module dependency.
The action store persists one exact pending command per workspace in account-keyed
tab session storage before dispatch. Unknown results survive same-tab reload and
replay the original body/key; known receipts recover using reads only. A definite
initial business rejection preserves the draft and requires explicit stock reload
before a new command. Reload clears old target/confirmation. Synchronization reads
the acted stock and operation-filtered journal before acknowledging the receipt,
even when recovery is opened from another stock detail. Account changes/explicit
logout invalidate old requests and clear the old account state. History presents
restricted locations distinctly from absent locations. Real Web flows and dialog
viewport checks are recorded in ../../docs/product/mvp-p11-acceptance-2026-10-20.md;
they do not constitute Tauri or whole-application mobile acceptance.

P10's material-owned attachment adapter uses the published schema and current
material read/update permissions. The file view provides cursor lists, metadata,
single PUT uploads and explicitly selected multipart uploads (up to the material
purpose's 100 MiB limit), SHA-256 verification,
binding, signed downloads and confirmed removal; archived materials remain readonly.
Upload intent/session/asset/reference state persists in account-keyed tab-session
storage, without signed URLs, binary content or credentials. Retrying completion
and binding reuses the original session and asset. Account changes abort and clear
the old runtime; same-tab reload requires reselecting and hashing the original file
when transfer remains incomplete. Confirmed writes recover synchronization by reads.
`platform/file-transfer` has no business dependency and sends signed storage requests
without application authentication. R06 resumes multipart uploads from validated
server part sizes/ETags and the original completion manifest, without persisting a
second local part list. Its isolated browser checks cover upload/recovery and Batch
inventory interaction. Local real-storage browser PUT/download/ETag/CORS and
two-part backend SHA-256/recovery checks now pass. The 2026-10-22 acceptance also
verifies authenticated multipart UI, partial/finalizing recovery and current grants
against PostgreSQL and isolated RustFS; deployment and cleanup scheduling remain
separate gates. See ../../docs/product/mvp-p10-acceptance-2026-10-22.md,
docs/remediation/2026-10-15/r06/audit-2026-10-21.md and
the material-p10 acceptance record.

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

R05 reorganizes material and inventory pages around the current HTTP contracts:
full-width detail identity/navigation, centered 1280px detail bodies, primary
facts with supporting stock/location/movement context, and server-paged related
inventory. Inventory owns the shared stock inspector and movement list; pages
compose them without new write APIs or fixture fallbacks. Receipt retains its
existing command/recovery owner but uses a Sheet with fixed header/actions and
an independently scrolling form. Facility's existing storage browser adds grid
coordinates, availability legend and keyboard focus movement; selection remains
in the node query. Single-item transfer remains P11, not P09 container relocation.
Visual checks and remaining gates are recorded in
`docs/remediation/2026-10-15/r05/README.md` and its dated acceptance record.

R05's follow-up adds a material-owned immediate Inspector shared by overview and
list, and a detail-private MaterialInventoryPanel composing paged batch choices,
URL batch context, current batch facts and filtered server inventory counts.
No reserved quantity or professional Bank projection is inferred. Material and
position entry points can prefill the existing receipt Sheet; a pending receipt's
original scope/body/key always takes priority. Position selection reads the current
topology/node, clears on read failures/loading and displays the full authorized path.
Facility exposes a node-content slot; inventory page composition reads position
stock without introducing a facility-to-inventory dependency. Parent layout refresh
follows receipt acknowledgment and closure, so the form cannot unmount prematurely.
Material editing provides first-error focus and explicit discard confirmation;
published field limits and the existing write owner remain authoritative.

## Design SSOT

- `docs/design/design-foundation.md`: token semantics, state language, typography, and visual constraints.
- `docs/design/ux.md`: application shell, navigation, overlay, and component interaction rules.
- `src/style.css`: authoritative CSS Token values and Tailwind theme mapping.
- `color-system-preview.html`: derived visual QA only; do not treat it as a second token source.
- `DESIGN.md`: retained external Notion design analysis, not a TalosArk design authority.
