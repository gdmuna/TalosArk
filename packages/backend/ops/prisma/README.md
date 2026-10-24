# Prisma CLI

The package's `pnpm prisma` command wraps the installed Prisma CLI. Commander
parses only wrapper options; Inquirer Select provides the terminal environment
picker. Prisma continues to own its commands, options, validation and prompts.
This tooling is independent of the backend runtime and never loads `secrets/env`.

## Environment Selection

Run these commands from `packages/backend`:

```powershell
# Interactive terminal: select an environment, then run the command.
pnpm db:push
pnpm db:gen-client
pnpm db:studio
pnpm db:init

# Explicit selection: no environment prompt.
pnpm prisma --env dev.local db push
pnpm prisma db push --env=dev.local
pnpm db:init --env-file ./ops/prisma/env/.env.staging
```

From the repository root, use `pnpm --filter @talos-ark/backend <script>`.
VS Code's npm script actions must run in an interactive terminal to show the picker.

- Without a selector, the picker discovers `.env` and `.env.*` files directly
  inside `ops/prisma/env`, excluding `.env.example` and `*.example` templates.
  File names are shown before credentials are read. No `dev` fallback remains.
- Existing aliases `dev`, `test`, `prod` and their `.local` variants keep their
  mappings. Other profile names resolve to `.env.<profile>` in the same directory,
  so adding `.env.staging` does not require code or an extra npm script.
- `--env-file` accepts an explicit file path, relative to the command's working
  directory. With a filtered pnpm script, that directory is `packages/backend`.
- Selectors support both `--option value` and `--option=value`, before or after
  Prisma arguments. Repeated selectors or combining both options is rejected.
- A literal `--` ends wrapper option parsing and is preserved for Prisma.
- When `CI` is set, or stdin/stdout is not a TTY, commands require an explicit
  selector. Cancellation does not start Prisma or execute SQL.
- The selected file must define `DATABASE_URL` and `SHADOW_DATABASE_URL`. Only
  these values are injected, overriding matching shell variables. Passwords in
  the connection URL credentials are masked in the startup log.
- Wrapper help (`pnpm prisma --help`), Prisma subcommand help and version queries
  do not require environment selection. For delegated help/version queries,
  non-connectable placeholder URLs satisfy Prisma's eager config loading.

This is an intentional behavior change for automation: commands that previously
relied on the implicit `dev` environment must now pass a selector. Prisma's own
arguments, including explicit datasource overrides, retain their native behavior.

## Database Initialization

`pnpm db:init` selects one environment and executes all regular `.sql` files
directly inside `prisma/ddl/init`, in filename order. `pnpm db:prepare` remains a
compatibility alias. Prisma's native `init` command is not replaced; the wrapper's
initialization flag is `--init`.

Initialization targets `DATABASE_URL` only. It does not create databases, change
the shadow database, run `db push`, install business triggers, backfill data, or
record Prisma migration history. PostgreSQL extension binaries and installation
permissions must already be available on the server. Currently the only script
enables `ltree` in `public`.

Each SQL file owns its transaction and must be safe to reapply. Execution stops
at the first failure, retaining its nonzero exit status; earlier committed files
are not rolled back as a group. If scripts acquire dependencies, use filename
prefixes to make their order explicit. Files outside `ddl/init` are never included.

See [the DDL guide](../../prisma/ddl/README.md) for schema synchronization ordering
and upgrade-policy boundaries.
