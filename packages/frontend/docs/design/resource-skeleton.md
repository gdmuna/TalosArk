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

`src/router/resource.ts` owns the three domain navigation lists and explicit lazy
route entries. Existing URLs remain valid; `inventory/ledger` now displays the
stock list and `inventory/storage-topology` displays the storage browser.

| Domain    | Second-level pages                                                   | Object and deep pages                                                          |
| --------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Material  | Overview, List, Culture                                              | Material detail with seven views; Cell Bank with four views; Batch             |
| Inventory | Overview, Stock list, Storage browser, Stocktake, Alert, Transaction | Inventory instance with three views; stocktake execution with four stage views |
| Equipment | Overview, List, Alert                                                | Equipment detail with five views; operation console                            |

Page-level navigation is outside the centered body and its scroll owner, matching
the workbench. Object routes hide that domain bar. Object views appear after a
stable object header; switching views only changes the query's `view` parameter,
preserving refresh and browser history. Stage selection in stocktake execution is
view navigation, not a task state transition.

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

List cells open a compact Sheet inspector; its full-detail action routes into the
corresponding domain. Existing `?resource=` links from the command palette and
workbench remain supported. Material-to-stock links use the existing explicit
`materialId`, never name matching or ID prefix inference. Unknown IDs, wrong
resource kinds and resources outside the active workspace show a missing-context
state rather than another workspace's data. Changing workspace resets list
selection and re-resolves object context.

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

`vue-tsc --noEmit` has no errors under `src/` from this implementation. The full
check remains blocked by 31 existing errors in obsolete tests that import retired
API, page, store and schema paths. These were not hidden with stubs or exclusions.
