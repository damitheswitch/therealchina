# Phase 1: Measurement

**Status:** implemented and merged to `staging` in PR #51. Production instrumentation was merged in PR #53 using the single available Umami website, but the production CSP initially blocked the tracker. The CSP fix is merged in PR #54 and is waiting for a Netlify production deploy because the account is out of build credits. Staging Umami verification was not performed because only the production Umami site exists. Baseline collection has not started. Last updated 2026-10-08.

**Depends on:** nothing. **Blocks:** Phase 2 (the dated baseline must exist before the flow changes).

**Overview:** [00-overview.md](00-overview.md) §5.

## Goal

Know where observed visitors drop out of the existing review flow, for signed-in and anonymous users, and record a dated "before" baseline that Phase 2 can be judged against.

Umami reports an observed visitor funnel, not an exact wizard-attempt ledger. Supabase reports authoritative published rows and a separate snapshot of idle signed-in drafts. They are complementary signals and are not joined by IDs.

## Approved owner decisions

**D1.1 Analytics tool and environments**

Decision: **Umami Cloud** for browser-side events, with separate production and staging Umami websites.

- Production tracks only the production hostname and production website ID.
- Staging uses a separate website ID on the exact staging hostname.
- Localhost and deploy previews do not track by default.
- If mainland/WeChat reachability fails consistently, choose between a first-party proxy and self-hosted Umami before treating the funnel as representative.

**D1.2 Privacy wording**

Approved sentence:

> We use Umami Cloud to measure how people use the review form so we can improve it. We do not send review text, email addresses, or account identifiers to Umami.

Processor list includes Supabase, Netlify, Cloudflare Turnstile, Resend, and Umami Cloud. Do not claim Umami receives no technical data: it receives tracker requests and derives device/session information.

**D1.3 Event contract**

| Event                                            | When it fires                                                                                 | Exact properties                         |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `review_started`                                 | Once after auth and draft loading resolve and the new-review wizard is usable                 | `flow`, `entry`, `auth`                  |
| `review_step_1_viewed` to `review_step_5_viewed` | First actual display of each step in this visit, including the loaded resume step             | `flow`, `entry`, `auth`, `step`, `stage` |
| `review_story_viewed`                            | First display of the legacy writing screen (step 4); reused for the later writing screen      | `flow`, `entry`, `auth`                  |
| `review_validation_failed`                       | A Next or Publish attempt blocked by client validation; once per step per visit               | `flow`, `auth`, `step`, `stage`          |
| `review_submit_attempted`                        | A validated Publish click immediately before Turnstile/request work; retries count separately | `flow`, `entry`, `auth`                  |
| `review_submit_failed`                           | Turnstile acquisition or submission fails                                                     | `flow`, `entry`, `auth`, `reason`        |
| `review_published`                               | Only after `submitReview` succeeds, before draft cleanup or the success animation             | `flow`, `entry`, `auth`, `duration_band` |

Enums:

- `flow`: `legacy_5`; a later value such as `fast_2` is reserved for Phase 2.
- `entry`: `new`, `resumed`, `unknown`.
- `auth`: `anonymous`, `signed_in`.
- `reason`: `turnstile_client`, `turnstile_server`, `server_input`, `rate_limited`, `auth_or_onboarding`, `network_or_unknown`, `server_error`.
- `duration_band`: `under_1m`, `1_to_2m`, `2_to_5m`, `over_5m`, `unknown`.
- `step`: `1` to `5`; `stage`: `basics`, `ratings`, `details`, `story`, `about_you`.

`entry=resumed` means a worthwhile server or local draft was actually loaded. A `?draft=` parameter alone is not resumption. Missing or failed lookups use `unknown`. Local drafts promoted after sign-in remain `resumed`.

`boost_card_completed` and `boost_exited` are reserved only. They are not allowed events until Phase 2 defines a fixed card-name enum.

## Privacy and payload boundary

The only place that talks to Umami is `frontend/src/lib/analytics.ts`. The wizard calls that helper, not the vendor API.

The payload is allowlisted twice:

1. `trackReviewEvent` requires an approved event name and that event's exact property set.
2. The Umami `beforeSend` hook rebuilds the request or drops it. Pageviews, arbitrary events, missing/extra properties, IDs, text, email, tokens, raw errors, URLs, and query strings are not sent.

Every event uses the fixed URL `/review`. Do not send `?draft=`, university names or IDs, account IDs, draft IDs, review IDs, review text, emails, claim tokens, Turnstile tokens, raw errors, or arbitrary caller properties. Do not call `identify`.

## Configuration

Required Vite variables:

```text
VITE_UMAMI_WEBSITE_ID=<deployment-specific website ID>
VITE_UMAMI_ALLOWED_HOSTNAMES=<exact hostname, comma-separated only if needed>
```

Optional overrides:

```text
VITE_UMAMI_SCRIPT_URL=<tracker URL>
VITE_UMAMI_HOST_URL=<collection host, used only for a proxy or request-level test>
```

Required account setup:

- production Umami Cloud website and dashboard access,
- exact production hostname configured,
- no preview wildcard in `VITE_UMAMI_ALLOWED_HOSTNAMES`.

Current setup: the free Umami account has one website, so only production is configured and staging tracking is intentionally off. If a staging website is added later, use a separate website ID and re-run the staging checklist before relying on its dashboard evidence.

## Milestones

1. **Implementation:** complete. Helper, wizard wiring, exact schemas, tests, environment gating, and privacy copy are merged to `staging` in PR #51. The staging deploy is `staging--therealchina.netlify.app`.
2. **Staging verification:** not performed. The free Umami account has only the production website, so staging analytics remains disabled. Production request/dashboard verification must therefore carry more weight, and the checklist below remains required if a staging site is added later.
3. **Production instrumentation:** Phase 1 code is merged to `master` in PR #53 and the CSP fix is merged in PR #54. Activation is pending the Netlify production deploy that applies PR #54; no production test reviews or test writes.
4. **Baseline collection:** pending the successful production tracker request and dashboard evidence. Needs at least one complete pre-Phase-2 observation week, raw sample sizes, dated read-only Supabase results, and separate idle-draft snapshots.

## Staging verification checklist

- New anonymous flow and new signed-in flow.
- Every step view, including resumed initial step.
- Back/forward navigation without duplicate step events.
- Client validation failure, deduplicated per step.
- Client Turnstile failure and server Turnstile rejection.
- Network failure, server input failure, rate limit, server error, retry then publish.
- Signed-in server draft, anonymous local draft, and local draft promoted after sign-in.
- Edit mode emits no new-review funnel events.
- Staging events reach only the staging website ID; localhost and deploy previews do not send.
- Actual request body contains only `website`, `url: "/review"`, `name`, and the exact event `data` properties.
- Staging Umami Events page and funnel show the events with raw counts.
- Mainland WeChat test without VPN, if a suitable device/network is available: script loads, collection request reaches Umami, staging dashboard shows the event, and Turnstile/Supabase calls are checked separately.

## Baseline queries

Run these read-only queries on production only after production instrumentation is live and the observation window is dated. Record the execution time, date bounds, and raw counts. Do not infer a conversion rate from draft rows.

```sql
-- Authoritative published outcomes for a bounded window.
select
  date_trunc('day', created_at)::date as day,
  count(*) as published_reviews,
  count(*) filter (where user_id is null) as anonymous_reviews,
  count(*) filter (where user_id is not null) as signed_in_reviews
from public.reviews
where deleted_at is null
  and created_at >= '<window_start_utc>'
  and created_at <  '<window_end_utc>'
group by 1
order by 1;
```

```sql
-- Optional-field fill rates for the same review cohort.
select
  count(*) as reviews,
  round(100.0 * count(rating_academics) / nullif(count(*),0)) as pct_academics,
  round(100.0 * count(rating_campus) / nullif(count(*),0)) as pct_campus,
  round(100.0 * count(rating_accommodation) / nullif(count(*),0)) as pct_accommodation,
  round(100.0 * count(rating_cost) / nullif(count(*),0)) as pct_cost,
  round(100.0 * count(rating_intl_office) / nullif(count(*),0)) as pct_intl_office,
  round(100.0 * count(rating_social) / nullif(count(*),0)) as pct_social,
  round(100.0 * count(rating_extracurricular) / nullif(count(*),0)) as pct_extracurricular,
  round(100.0 * count(rating_career) / nullif(count(*),0)) as pct_career,
  round(100.0 * count(tuition_range) / nullif(count(*),0)) as pct_tuition,
  round(100.0 * count(living_cost_range) / nullif(count(*),0)) as pct_living_cost,
  round(100.0 * count(funding_type) / nullif(count(*),0)) as pct_funding,
  round(100.0 * count(funding_coverage) / nullif(count(*),0)) as pct_funding_coverage,
  round(100.0 * count(nullif(btrim(pros), '')) / nullif(count(*),0)) as pct_pros,
  round(100.0 * count(nullif(btrim(cons), '')) / nullif(count(*),0)) as pct_cons,
  round(100.0 * count(*) filter (where cardinality(tags) > 0) / nullif(count(*),0)) as pct_tags,
  round(100.0 * count(*) filter (where jsonb_array_length(media) > 0) / nullif(count(*),0)) as pct_media
from public.reviews
where deleted_at is null
  and created_at >= '<window_start_utc>'
  and created_at <  '<window_end_utc>';
```

```sql
-- Idle signed-in draft snapshot. This is not a denominator for completion.
select
  progress as stopped_at_step,
  count(*) as idle_drafts,
  min(updated_at) as oldest_update,
  max(updated_at) as newest_update
from public.review_drafts
where updated_at < now() - interval '1 hour'
group by progress
order by progress;
```

## Baseline record

| Capture date/time (UTC) | Observation window (UTC) | Umami starts | Umami publishes | Published rows | Anonymous rows | Signed-in rows | Optional-field results | Idle-draft snapshot | Notes        |
| ----------------------- | ------------------------ | -----------: | --------------: | -------------: | -------------: | -------------: | ---------------------- | ------------------- | ------------ |
| pending                 | pending                  |      pending |         pending |        pending |        pending |        pending | pending                | pending             | Not captured |

## Done when

- Staging verification is complete if a separate staging website exists; otherwise it is explicitly recorded as not performed.
- Production instrumentation is deployed and verified with actual request and dashboard evidence.
- At least one complete pre-Phase-2 observation week is recorded with raw sample sizes.
- Dated read-only Supabase outcomes and idle-draft snapshots are recorded above.
- Phase 2 remains unreleased until the baseline exists.
