# Issue tracker: Local Markdown

Issues and PRDs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The PRD is `.scratch/<feature-slug>/PRD.md`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue file; see `triage-labels.md` for the allowed values
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/`, creating the directory if needed.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user normally passes the path or issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The map is a file with one child file per ticket.

- **Map:** `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body
- **Child ticket:** `.scratch/<effort>/issues/<NN>-<slug>.md`, numbered from `01`; a `Type:` line records `research`, `prototype`, `grilling`, or `task`, and a `Status:` line records `claimed` or `resolved`
- **Blocking:** a `Blocked by: <NN>, <NN>` line near the top; a ticket is unblocked when every listed file is `resolved`
- **Frontier:** scan `.scratch/<effort>/issues/` for open, unblocked, unclaimed tickets; first by number wins
- **Claim:** set `Status: claimed` and save before work
- **Resolve:** append the answer under `## Answer`, set `Status: resolved`, then append a context pointer to the map's Decisions-so-far section
