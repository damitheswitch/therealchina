-- =========================================================
-- 026_seed_demo_reviews.sql
--
-- DEMO SEED DATA (not schema). Six realistic anonymous reviews on three
-- universities so the review-summary card and the listing "recommend" pill
-- have enough recommend answers to render (pill gate: answered >= 2).
-- Universities are resolved BY SLUG so this replays on any environment that
-- has those universities; rows whose university is absent are skipped.
--
-- Combined figures on the live DB at seed time (existing answers counted):
--   Tsinghua  +2 yes +1 maybe  (+1 existing yes)   -> 3/4 = 75%  rec-yes
--   Peking    +1 maybe         (+1 existing yes)   -> 1/2 = 50%  rec-maybe
--   Fudan     +2 no            (+1 existing maybe) -> 0/3 = 0%   rec-no
-- On a fresh DB without those pre-existing answers: Tsinghua shows 67% and
-- Peking's pill stays hidden (only 1 answer).
--
-- Fixed UUIDs + ON CONFLICT DO NOTHING keep this idempotent and make
-- cleanup a single DELETE:
--   DELETE FROM public.reviews WHERE id IN (
--     'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
--     'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
--     'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
--     'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
--     'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
--     'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16');
--
-- Media URLs are public placeholders (picsum / Google sample bucket) —
-- direct table inserts are not bound by review-submit's bucket-prefix
-- validation. Review triggers refresh university_stats automatically.
-- =========================================================

INSERT INTO public.reviews (
  id, university_id, user_id, rating, text,
  program, degree_level, enrollment_status, start_year, end_year,
  language_of_instruction, tuition_range, living_cost_range,
  funding_type, funding_coverage, recommend,
  rating_academics, rating_campus, rating_accommodation, rating_cost,
  rating_intl_office, rating_social, rating_extracurricular, rating_career,
  pros, cons, tags, media, created_at
)
SELECT
  v.id, u.id, NULL, v.rating, v.text,
  v.program, v.degree_level, v.enrollment_status, v.start_year, v.end_year,
  v.language_of_instruction, v.tuition_range, v.living_cost_range,
  v.funding_type, v.funding_coverage, v.recommend,
  v.rating_academics, v.rating_campus, v.rating_accommodation, v.rating_cost,
  v.rating_intl_office, v.rating_social, v.rating_extracurricular, v.rating_career,
  v.pros, v.cons, v.tags, v.media, v.created_at
FROM (
  VALUES
    -- ---- Tsinghua University ----
    (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'tsinghua', 5,
      'Two years into my master''s and the research access here is unreal — my lab publishes constantly and professors actually reply to emails. The workload is heavy but the campus feels like its own small city.',
      'Computer Science', 'Master', 'current', 2023, NULL,
      'English', '¥40k–¥80k', '¥4k–¥8k',
      'csc', 'full', 'yes',
      5, 5, 3, 3,
      4, 4, 5, 5,
      'World-class labs and libraries. CSC funding covered tuition and a decent stipend.',
      'Dorms are dated for the price, and course registration for international students is confusing.',
      ARRAY['Strong academics', 'Research opportunities', 'Beautiful campus', 'Active clubs'],
      '[
        {"url": "https://picsum.photos/seed/trc-tsinghua-quad/800/600", "type": "image", "name": "main-quad.jpg"},
        {"url": "https://picsum.photos/seed/trc-tsinghua-lib/800/600", "type": "image", "name": "library.jpg"}
      ]'::jsonb,
      NOW() - INTERVAL '16 days'
    ),
    (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid, 'tsinghua', 4,
      'Studied here 2018–2022. Brutal grading but employers across Asia know the name — it opened doors everywhere. Dorms are basic; bring your own kettle and lower your expectations.',
      'Mechanical Engineering', 'Bachelor', 'alumni', 2018, 2022,
      'Bilingual', '¥20k–¥40k', '¥2k–¥4k',
      'self', NULL, 'yes',
      5, 4, 3, 4,
      NULL, 3, NULL, 5,
      NULL, NULL,
      ARRAY['Strong academics', 'Hard grading', 'Good career support'],
      '[]'::jsonb,
      NOW() - INTERVAL '9 days'
    ),
    (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid, 'tsinghua', 4,
      'One-semester exchange. The language classes were excellent and the campus is genuinely beautiful, but the international office was slow with paperwork — start your visa admin early.',
      'Chinese Language', 'Exchange', 'exchange', 2024, 2025,
      'Chinese (Mandarin)', NULL, '¥4k–¥8k',
      'school', 'partial', 'maybe',
      4, 5, NULL, 4,
      3, 5, 4, NULL,
      'Amazing campus life, great food, easy to meet people through clubs.',
      'International office response times; dorm heating is centrally controlled.',
      ARRAY['Great food', 'International-friendly', 'Beautiful campus', 'Good nightlife'],
      '[
        {"url": "https://picsum.photos/seed/trc-tsinghua-canteen/800/600", "type": "image", "name": "canteen.jpg"},
        {"url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", "type": "video", "name": "campus-walk.mp4"}
      ]'::jsonb,
      NOW() - INTERVAL '4 days'
    ),
    -- ---- Peking University ----
    (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14'::uuid, 'peking', 4,
      'Great name and brilliant classmates, but the admin is a maze — every form needs three stamps and two offices. Worth it if you are patient and your Chinese is solid.',
      'Economics', 'Bachelor', 'current', 2022, NULL,
      'Chinese (Mandarin)', '¥20k–¥40k', '¥4k–¥8k',
      'province', 'partial', 'maybe',
      5, 4, 2, 3,
      3, 4, NULL, 4,
      NULL, NULL,
      ARRAY['Strong academics', 'Great food', 'Hard bureaucracy'],
      '[]'::jsonb,
      NOW() - INTERVAL '6 days'
    ),
    -- ---- Fudan University ----
    (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15'::uuid, 'fudan', 2,
      'Shanghai is an amazing city but the program felt overpriced for what you get. International office support was thin when I needed visa help, and nobody warned me about the living costs.',
      'Journalism', 'Master', 'alumni', 2019, 2021,
      'English', '¥80k–¥150k', 'Over ¥8k',
      'self', NULL, 'no',
      3, 4, 2, 1,
      2, 3, NULL, 2,
      NULL,
      'Tuition plus Shanghai rent adds up fast; support for international students was limited.',
      ARRAY['Expensive city', 'Hard bureaucracy'],
      '[]'::jsonb,
      NOW() - INTERVAL '21 days'
    ),
    (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16'::uuid, 'fudan', 3,
      'Fun semester and the food scene is unbeatable, but everything near campus is expensive and my dorm had mold. Come for the city, not the facilities.',
      NULL, 'Exchange', 'exchange', 2022, 2023,
      'English', NULL, 'Over ¥8k',
      NULL, NULL, 'no',
      NULL, 4, 2, 1,
      NULL, 4, 3, NULL,
      'Unbeatable food and nightlife; easy city to live in as a foreigner.',
      'Dorm quality and prices near campus.',
      ARRAY['Expensive city', 'Good nightlife', 'Great food'],
      '[
        {"url": "https://picsum.photos/seed/trc-fudan-street/800/600", "type": "image", "name": "street-food.jpg"},
        {"url": "https://picsum.photos/seed/trc-fudan-river/800/600", "type": "image", "name": "suzhou-creek.jpg"}
      ]'::jsonb,
      NOW() - INTERVAL '11 days'
    )
) AS v (
  id, uni_slug, rating, text, program, degree_level, enrollment_status,
  start_year, end_year, language_of_instruction, tuition_range, living_cost_range,
  funding_type, funding_coverage, recommend, rating_academics, rating_campus,
  rating_accommodation, rating_cost, rating_intl_office, rating_social,
  rating_extracurricular, rating_career, pros, cons, tags, media, created_at
)
JOIN public.universities u ON u.slug = v.uni_slug
ON CONFLICT (id) DO NOTHING;
