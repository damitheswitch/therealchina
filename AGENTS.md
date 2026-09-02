# Agent Rules — TRC Project

These rules are mandatory. Prefer following them even when a faster path exists.

## Database / Supabase

**Canonical schema**: `supabase/schema_snapshot.sql` is the single source of truth for the current database state.

When doing anything database-related (migrations, schema changes, RLS, views, functions, grants):

1. Always start from `supabase/schema_snapshot.sql`.
2. After any change (add/alter/drop table, column, index, function, trigger, view, RLS policy, or grant), update `supabase/schema_snapshot.sql` so it matches the final schema. Never leave it stale.
3. Do **not** read the entire `supabase/migrations/` folder by default. The numbered files are historical only.
4. If you need the history of a specific change, open only the relevant migration file (e.g. `017_definer_view_qualified_names.sql`).
5. New migrations go in `supabase/migrations/` with the next number. Update `schema_snapshot.sql` in the same change.
6. Never delete, rename, or squash migration files unless the user explicitly asks.

## Code Standards

### Language
- TypeScript-first. All **new** frontend source files must be `.ts` / `.tsx`.
- Do not convert existing `.jsx` files unless the task is a deliberate migration **and** you are already substantially rewriting the file.
- Edge Functions are already TypeScript — keep them that way.

### Verification (required before finishing any task)
These must pass. Treat them as a hard gate:

1. `cd frontend && npm run lint` — zero errors. Fix any new warnings you introduce.
2. `cd frontend && npm run format` 
3. `cd frontend && npm run build` — must succeed.
4. Edge Function changes:  
   `npx deno check --config supabase/functions/<fn>/deno.json supabase/functions/<fn>/index.ts` 

Do not claim a task is complete until the relevant checks above pass.

### React / Frontend
- Every async `useEffect` **must** have a cleanup path (AbortController / abort signal or mounted guard). No exceptions.
- Never write to refs during render. Assign `ref.current` only inside effects or event handlers.
- No mutable module-level counters or shared state across component instances. Use `useRef` per instance.
- Never fetch per-row inside a loop. Batch with `.in('column', ids)` (or equivalent) in the parent.
- Never use `key={index}` on lists that can reorder, filter, or grow. Use stable IDs.
- Extract data-fetching into custom hooks (`useX`) instead of repeating `useState` + `useEffect` boilerplate.
- Accessibility is required:
  - Form inputs need an associated `<label htmlFor=...>` or `aria-label`.
  - Dialogs need `role="dialog"`, `aria-modal="true"`, initial focus, and focus trapping.
  - Never auto-open modals on page load.
- No `console.log` in committed code. `console.error` is allowed only on genuine error paths.
- Prefer explicit column lists over `select('*')` from Supabase.

### Security (non-negotiable)
- Never trust JWT claims decoded only on the client or via base64. Always verify server-side (`supabase.auth.getUser(token)` or proper signature check) before granting privilege. Fail closed.
- Abuse-sensitive writes must go through gated paths (Edge Function + Turnstile / rate limits). Never allow direct anonymous table inserts for those operations.
- Never commit secrets (`.env` files, service-role keys, etc.). Anon/public keys are fine; service-role keys are not.
- Never trust client-controlled headers (`X-Forwarded-For`, `Origin`, `User-Agent`, etc.) for security decisions.
- If a rate limiter or external check (e.g. Turnstile) is unavailable, default to **reject**. Only fail-open if the user explicitly approves it and the decision is documented.

### Tests
- New logic in `frontend/src/lib/` and changes to Edge Function logic should include tests once a harness exists (Vitest / Deno test).
- If no harness exists yet, create the minimal one needed rather than skipping tests.

### Git Hygiene
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, etc. No placeholder messages.
- Do not leave staged-but-uncommitted files when finishing a task.
- Work on feature branches → PR into `staging` → then `master`.

## When in doubt
- Prefer the safer / more explicit option.
- Prefer updating `schema_snapshot.sql` and running the verification commands over “I’ll do it later”.
- If a rule conflicts with the user’s explicit instruction, follow the user’s instruction and note the deviation.
