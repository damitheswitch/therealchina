# Snapshot branches (temporary)

Created 2026-10-30 so work that only existed on one machine is visible on GitHub.
Nothing here is meant to be merged. None of these branches has a PR, and none
should get one (a PR into `staging` or `master` triggers a Netlify deploy preview).

All snapshot branches share the prefix `snapshot/`. Deleting that prefix removes
everything this document describes. The real branches (`master`, `staging`, and
the feature branches) were not touched.

## Branches

| Branch | Contents | Based on |
|---|---|---|
| `snapshot/uncommitted` | This branch. Uncommitted work from the main checkout: edits to `.gitignore`, `AGENTS.md`, `docs/engagement/00-overview.md`, `docs/engagement/07-incentives.md`, plus new `.devin/skills/` and `marketing/` | `master` (be6e78d) |
| `snapshot/backup-audit-local-review` | 18 commits, never pushed (migrations 050/051, audit follow-ups) | local `backup/audit-local-review` |
| `snapshot/phase2-fast-review-flow` | 7 commits, never pushed. A `-clean` version is on `origin/feat/phase2-fast-review-flow-clean` | local `feat/phase2-fast-review-flow` |
| `snapshot/phase3-anon-boost` | Local commits that diverged from `origin/feat/phase3-anon-boost` | local `feat/phase3-anon-boost` |
| `snapshot/community-ask-dropdowns` | Local commits that diverged from the remote branch | local `fix/community-ask-dropdowns` |
| `snapshot/flights-contact-picker` | Local commits that diverged from the remote branch | local `feat/flights-contact-picker` |
| `snapshot/release-phase1-production` | 4 local commits not on `master` | local `release/phase1-production` |
| `snapshot/stash-flight-page` | Old stash: flight listings page WIP (from `feat/guides`) | stash |
| `snapshot/stash-flight-listings-all` | Old stash: flight listings WIP | stash |
| `snapshot/stash-flight-listings-guides` | Old stash: flight card, form, page and CSS WIP | stash |

Stash branches are commits created from `git stash`. Their tree is the stashed
state, and their first parent is the commit the stash was made on.

## Deleting all of it later

Remote (GitHub):

```bash
git ls-remote --heads origin 'refs/heads/snapshot/*' | awk '{print $2}' | sed 's#refs/heads/##' | xargs -r git push origin --delete
```

Local clone:

```bash
git branch --list 'snapshot/*' | xargs -r git branch -D
```

Before deleting, check that nothing on a snapshot branch is still wanted.
`git log master..snapshot/<name>` shows what each one holds.
