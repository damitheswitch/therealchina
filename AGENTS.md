# Agent Rules — TRC Project

## Database / Supabase

The canonical, current database schema is captured in `supabase/schema_snapshot.sql`.

When working on anything database-related (new migrations, schema changes, RLS, views, functions):

1. **Start from `supabase/schema_snapshot.sql`** for the current schema state.
2. **Always keep `supabase/schema_snapshot.sql` up to date.** If you add, alter, or drop any table, column, index, function, trigger, view, RLS policy, or grant, update `supabase/schema_snapshot.sql` so it reflects the final state of the schema after your change. Treat it as the single source of truth for the current DB structure.
3. **Do not read all of `supabase/migrations/` by default.** The numbered files are historical.
4. If you need to know the *chronology* of a change, read only the specific numbered migration that introduced it (e.g. `017_definer_view_qualified_names.sql`).
5. If you are writing a new migration, place the numbered migration in `supabase/migrations/` **and** update `supabase/schema_snapshot.sql` with the same final state.
6. Do not delete, rename, or squash `supabase/migrations/` files unless the user explicitly asks for it.
