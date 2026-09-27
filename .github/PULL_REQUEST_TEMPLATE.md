## Summary

<!-- What changed and why -->

## SEO impact

<!-- Required for changes touching routes, slugs, metadata, redirects,
     prerendering, sitemap, reviews data, or files under src/lib/seo/,
     frontend/scripts/, netlify.toml, vite.config.js. -->

- [ ] No SEO-sensitive changes (default)
- [ ] Adds/removes a route → registered in `src/lib/seo/policy.ts` and covered by tests
- [ ] Changes metadata/JSON-LD → `npm run build` + `node scripts/validate_build.mjs` pass
- [ ] Touches slugs/aliases → old slugs preserved in `slug_aliases`
- [ ] Touches reviews/stats data → structured data still matches visible content
- [ ] Deploy checked with `node scripts/smoke_live.mjs <preview> --preview`

## Test plan

- [ ] `npm run lint` (0 errors) · `npm run format` · `npm run typecheck`
- [ ] `npm test` passes
- [ ] `npm run build` + `node scripts/validate_build.mjs` pass
