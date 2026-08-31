# Supabase migrations

Database changes used to be SQL files in `scripts/**` that someone pasted into the
dashboard by hand. That is how `api.passport_stamps` shipped without its GRANTs and
broke every stamp with a 42501 for weeks — nothing tracked whether a file had
actually been run.

From now on, schema changes are **migrations in `supabase/migrations/`**, applied by
CI on merge to `main`.

## One-time setup — DONE 2026-08-31

The project is linked and the first migration is applied. Kept here as a record,
and for setting this up on another machine.

```bash
# 1. Authenticate. Opens a browser; or create a token at
#    https://supabase.com/dashboard/account/tokens
npx supabase login

# 2. Link this repo to the project. Asks for the database password.
npx supabase link --project-ref bkaxadiyehddzkiuheea

# 3. Baseline. See "the existing SQL" below before running this.
npm run db:status
```

### The baseline mismatch (already resolved — read if it recurs)

The remote already had a migration version recorded, `20251013122453`, from before
this repo used the CLI. That made `db push` and `db pull` refuse with
`Remote migration versions not found in local migrations directory`.

The CLI suggests repairing by marking the *pending* migration as `applied` — **do
not do that**, it records a migration as done without ever running it. Instead we
added an empty local placeholder with the matching version
(`20251013122453_baseline_pre_cli.sql`), which reconciles the histories without
writing to the remote and without losing the record that something was applied then.

Then add ONE repo secret so CI can apply migrations
(GitHub → repo → Settings → Secrets and variables → Actions):

| Secret | Where it comes from |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens |

**No database password is needed.** CLI 2.x provisions a temporary Postgres login
role through the Management API using the access token — which is why the first
migration applied here with no password stored anywhere on disk or in the keychain.
Supabase never re-reveals a database password anyway; it can only be reset, and
resetting would break the direct-connection scripts in `scripts/places-pilot/`
that authenticate with `PGPASS`.

And optionally require approval before a migration lands:
Settings → Environments → `production` → required reviewers.

## Everyday flow

```bash
npm run db:new add_footprint_radius   # creates supabase/migrations/<ts>_add_footprint_radius.sql
# ...write the SQL...
npm run db:plan                       # dry run — shows exactly what would be applied
npm run db:push                       # apply to the linked project
npm run db:status                     # what is applied vs pending
```

Commit the migration. On merge to `main`, `.github/workflows/deploy-migrations.yml`
applies it automatically — the same shape as the worker deploy, but gated on the
`production` environment because a bad migration can be irreversible.

## The existing SQL — read before baselining

~30 SQL files under `scripts/**` and `supabase/crm-schema.sql` were applied by hand
over months. They are **not** migrations and must not be replayed blindly. Most are
written idempotently (`create table if not exists`, `create or replace function`),
but some are one-off data operations, not schema.

Two things to know:

1. **The migration history starts now.** `20260831155723_passport_table_grants.sql`
   is the first tracked migration. Everything before it is historical; leave those
   files in `scripts/` as a record and do not convert them.

2. **To get a true baseline of what is actually live**, run:
   ```bash
   npm run db:pull      # introspects the remote and writes a baseline migration
   ```
   This snapshots the current `public` + `api` schemas so future `db diff` output is
   meaningful. Review what it generates before committing — it will be large.

## Which SQL does NOT belong here

`cloudflare-worker/sql/*.sql`, `analytics-schema.sql` and
`scripts/analytics/alter_anon_id.sql` target **Cloudflare D1**, not Supabase Postgres.
Those still run through `npx wrangler d1 execute`. Two databases, two tools — don't
mix them up.

`scripts/places-pilot/**` beyond `01_schema.sql` are DuckDB extract/load pipeline
steps, not schema. They stay where they are.

## Note on schemas

App tables live in the **`api`** schema (the exposed Data API schema), not `public`.
Anything you create there needs an explicit grant — Supabase auto-grants in `public`
only, which is the exact bug the first migration fixes:

```sql
grant all privileges on api.your_table to service_role;
notify pgrst, 'reload schema';
```
