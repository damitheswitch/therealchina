// Shared PostgREST select strings. One literal per projection so adding a
// column can't silently update some feeds while others keep serving stale
// shapes — these lists were copy-pasted across hooks and had already drifted
// (different embeds, extra columns). Keep them as plain string consts: the
// literal type is what lets supabase-js infer row shapes.

// Full review card/page row — everything ReviewCard, summary and display
// helpers read (all migration-022 fields).
export const REVIEW_COLUMNS =
  'id, university_id, user_id, rating, text, program, degree_level, media, created_at, enrollment_status, start_year, end_year, language_of_instruction, tuition_range, living_cost_range, funding_type, funding_coverage, recommend, pros, cons, tags, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career'

// Minimal row for "has more pages" / total-count probes.
export const REVIEW_HEAD_COLUMNS = 'id, rating, created_at'

// University row as rendered on directory/city/hub/detail pages.
export const UNI_COLUMNS =
  'id, name, name_zh, city, country, province, uni_category, slug, logo_url, is_verified, uni_type, languages_of_instruction, website, rankings, slug_aliases'

// Own-profile row (the columns ProfileContext exposes to the app).
export const PROFILE_COLUMNS =
  'display_name, bio, location, university, program, social_handles, social_platform, social_handle, show_social_handle, is_discoverable, onboarding_completed, home_country, current_status, languages_spoken, email_consent'

// university embed shapes used alongside REVIEW_COLUMNS.
export const REVIEW_UNI_EMBED = 'universities(name, city, slug)'
export const REVIEW_UNI_EMBED_PROVINCE = 'universities(name, city, province, slug)'
