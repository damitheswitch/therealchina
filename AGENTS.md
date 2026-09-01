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

## Code Standards

These rules exist to keep quality consistent across sessions and models. Follow them for every change.

### Language

- **TypeScript-first.** All NEW frontend source files must be `.ts` / `.tsx`. Do not convert existing `.jsx` files unless the task is specifically a migration — convert a file only when you are already substantially rewriting it, and do it in the same change.
- Edge Functions are already TypeScript; keep them that way.

### Verification (required before finishing any task)

1. `cd frontend && npm run lint` — must exit with 0 errors. Fix new warnings you introduce.
2. `cd frontend && npm run format` — run Prettier on the repo before committing.
3. `cd frontend && npm run build` — must pass.
4. For Edge Function changes: `npx deno check --config supabase/functions/<fn>/deno.json supabase/functions/<fn>/index.ts`.

### React / Frontend

- **Every async `useEffect` must have a cleanup path** (`AbortController` / abort signal or mounted guard). No exceptions.
- **Never write refs during render.** Assign `ref.current` only in effects or event handlers.
- **No mutable module-level counters/state** shared across component instances (e.g. `let nextItemId = 0`). Use `useRef` per instance.
- **No per-row fetching in loops.** If a list of N items needs related data, batch the query in the parent (`.in('user_id', ids)`) instead of one request per card.
- **No `key={index}`** on lists that can reorder or grow; use stable IDs.
- **Extract data-fetching into hooks** (`useX`) instead of repeating `useState` + `useEffect` fetch boilerplate per component.
- **Accessibility is not optional:** form inputs need a label with `htmlFor` (or `aria-label`); dialogs need `role="dialog"`, `aria-modal="true"`, initial focus and focus trapping; never auto-open modals on page load.
- **No `console.log` in committed code.** `console.error` is allowed for genuine error paths.
- Don't select `*` from Supabase; list the columns you actually use.

### Security (non-negotiable)

- **Never trust JWT claims decoded client-side or via base64 alone.** Verify tokens server-side (`supabase.auth.getUser(token)` or signature check) before granting any privilege. Fail closed.
- **Abuse-sensitive writes go through gated paths** (Edge Function with Turnstile / rate limits), not direct anonymous table inserts.
- **Never commit secrets** (`.env` files, service role keys). Public/anon keys are fine; service keys are not.
- **Never trust client headers** (`X-Forwarded-For` first hop, `Origin`, `User-Agent`) for security decisions.
- When the rate limiter or an external check (e.g. Turnstile) is down, default to rejecting unless the user explicitly approves a fail-open trade-off, and document it.

### Tests

- New logic in `frontend/src/lib/` and changes to Edge Function logic should come with tests once the harness exists (Vitest / Deno test). If no harness exists yet, create the minimal one needed instead of skipping the test.

### Git Hygiene

- Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:` ...). No placeholder messages.
- Don't leave staged-but-uncommitted files behind when finishing a task.
- Work happens on feature branches merged via PR into `staging`, then `master`.
