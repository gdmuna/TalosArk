# Material, Inventory and Equipment Skeletons

## References and Scope

The reviewed sources are `output/design/frozen-v2-71-2026-09-29/README.md`,
`REVIEW-NOTES.md`, `source-navigation-surface-matrix-v2.txt`, and all 29 images
in B-01 through B-11, C-01 through C-09, and D-01 through D-09.
Current components and design tokens take precedence over illustrative styling.

This iteration establishes page composition and navigation, not resource API
contracts or new backend MVP requirements. Culture, lineage, quality control and
Cell Bank / Batch remain professional-workspace skeletons. Hardware control is
still a later phase, as specified in `docs/product/mvp-scope.md`.

## Navigation

`src/router/resource.ts` owns the three domain navigation lists and explicit static
route entries. `inventory/ledger` now displays the
stock list and `inventory/storage-topology` displays the storage browser.

| Domain    | Second-level pages                                                   | Object and deep pages                                                             |
| --------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Material  | Overview, List                                                       | Material detail with capability-dependent views; Cell Bank with four views; Batch |
| Inventory | Overview, Stock list, Storage browser, Stocktake, Alert, Transaction | Inventory instance with three views; stocktake execution with four stage views    |
| Equipment | Overview, List, Alert                                                | Equipment detail with five views; operation console                               |

Page-level navigation is outside the centered body and its scroll owner, matching
the workbench. Object routes hide that domain bar. `ResourceDetailPage` gives the
object header and local navigation a full-width top region outside the body scroll
owner. Body compositions choose their own intrinsic widths and are margin-centered;
switching views does not move the top region. Switching views only changes the query's `view` parameter,
preserving refresh and browser history. Stage selection in stocktake execution is
view navigation, not a task state transition.

The 2026-10-09 material redesign removes `/main/material/culture` and its independent
page. Biological Material, Chemical Reagent and Consumable share the material
catalog. Culture and lineage remain local views only for explicitly cultivable
biological materials; unsupported `view=culture|lineage` requests display Overview.
See `material-page-redesign.md` for the revised material composition and naming.

Object route shapes:

- `/main/material/detail/:resourceId?view=overview|instance|culture|lineage|quality|file|activity`
- `/main/material/detail/:resourceId/bank/:bankId?view=overview|batch|quality|file`
- `/main/material/detail/:resourceId/bank/:bankId/batch/:batchId`
- `/main/inventory/detail/:resourceId?view=overview|movement|file`
- `/main/inventory/stocktake/:taskId?view=prepare|count|review|complete`
- `/main/equipment/detail/:resourceId?view=runtime|information|binding|maintenance|command`
- `/main/equipment/detail/:resourceId/console`

## Ownership and Data Boundaries

The three domain directories own their page compositions and private `detail/`
views. `page/resource/` contains shared application-level presentation helpers,
not a business module, transport facade or new source of truth. `ResourceTable`
renders unloaded table structure; its field tuples are presentation metadata,
not API models. `ResourceList` composes the existing public workbench and workspace
stores to show only resource summaries already available in the active workspace.

Identity cells open a compact Sheet inspector. The primary detail button routes
into the corresponding detail page where available, otherwise retaining the
business inspector. The row menu offers all registered actions without inventing unloaded write
operations. DataTable provides a column-based default preview when a caller has no
business inspector. Existing `?resource=` links from the command palette and
workbench remain supported. Material-to-stock links use the existing explicit
`materialId`, never name matching or ID prefix inference. Unknown IDs, wrong
resource kinds and resources outside the active workspace show a missing-context
state rather than another workspace's data. Changing workspace resets list
selection and re-resolves object context.

Breadcrumb levels are supplied by their owning domain, detail context and local
view navigation. For example, material detail shows Material / Material list /
record name / current view. A record-name popover searches known summaries in the
active workspace and retains a compatible current view when switching records.
Deep routes add their explicit ancestors without claiming those records are loaded.
List breadcrumbs use the last complete list URL in the
application session, including query parameters. List search is backed by `q`;
table-only sort, sizing and selection remain local UI state.

Object-header quick returns are independent of catalog breadcrumbs. They use the
entry's source URL, label and browser-history position; query-view changes retain
that source, and record-picker switches preserve it. Crossing from an inventory
instance into its material therefore returns to that inventory instance, not the
material catalog. Direct URL entries fall back to the page's declared parent.
History metadata survives refresh.

Detail navigation and record switches are immediate, without whole-page fade or
translation. Keyed outlets replace content and its breadcrumb providers together;
there is no outgoing page layer or delayed incoming mount. Component-level motion
for overlays, the sidebar and drag reordering is unchanged.
The row menu exposes all registered actions, including the primary detail action.

Entry-only `resource`, `task`, `approval` and `exception` query commands are consumed
before opening their local inspectors. Storage browser resource selection follows
the same one-shot policy. Cleanup replaces the current history entry, preserves
other query values and the hash, and does not reset the opened selection. Persistent
search, branch and view parameters remain navigable state. Returning to a consumed
entry or refreshing it no longer reopens an inspector.

Known resource names, IDs, descriptions and summary states may be shown. Other
fields stay unloaded: quantities, dates, storage nodes, slot layout and occupancy,
culture events, batches, quality records, files, device connectivity, telemetry,
bindings, maintenance and command receipts. Missing counters are not zero. Empty
tables have no authoritative business records; their pagination counts describe
only the current local presentation rows.

Facility selection uses known facility summaries only. It does not invent a
storage hierarchy, equate a facility with equipment, or claim an unoccupied grid.
Bank, Batch and stocktake route parameters identify requested contexts only;
their records and relations are not claimed to be loaded or verified.

Navigation, view selection, resource preview and existing explicit resource links
are interactive. Create, edit, import/export, inventory movement, binding,
maintenance, QC, scan/count submission and hardware command actions are disabled.
No skeleton action reports fabricated success. Flow and command histories remain
read-only, and dangerous device actions are separately collapsed and disabled.

## Verification

The implementation passed scoped ESLint (including import boundaries) and the
production Vite build. Inline Playwright checks in headless Edge covered 37 views
at 1024, 1440 and 2560 pixels plus five missing-context cases: 116 checks with no
page errors. Additional interaction checks covered Sheet-to-detail navigation,
material/instance links, query-view history, workspace changes, storage view modes,
disabled command actions, collapsed sidebar and scrolling in a 480-pixel window.
The domain navigation's left edge remained unchanged across all second-level pages.
Screenshots are kept in ignored `output/qa/`; no test scripts were added.

The preview/detail and contextual-breadcrumb iteration additionally checked 40
detail layouts at 1024, 1586, 2248 and 2560 pixels, including a 480-pixel-high
window. Inline browser checks covered identity-cell previews, row menus, primary
detail routing and inspector fallback, embedded stock instances, keyboard record
search/selection, list query restoration, provider disposal, collapsed-sidebar
layout and the column-based default inspector. The object top region stays outside
the body scroll owner; no document overflow or page errors were found.

The route and account iteration additionally checked 45 layouts at 1024, 1586 and
2248 pixels, including a 480-pixel-high window. Browser interaction checks covered
all registered row actions, source-aware quick returns, record-picker switches,
refresh persistence, cross-domain transitions, rapid navigation and reduced motion.
Initial renders and query-only view changes do not animate. No test scripts were added.

`vue-tsc --noEmit` passes with the current project configuration. An earlier full
check reported 31 errors in obsolete tests importing retired API, page, store and
schema paths; those tests are now outside the configured check and were not repaired
in this iteration.
