-- Demo reviews for local testing: 12 rich reviews on Tsinghua so the
-- reviews pagination (8/page → 2 pages) and the collapsible cards are
-- visible in local dev. Local Docker stack only — never run against
-- staging or prod.

INSERT INTO reviews (
  university_id, user_id, rating, text, program, degree_level,
  enrollment_status, start_year, end_year, language_of_instruction,
  tuition_range, living_cost_range, funding_type, funding_coverage,
  recommend, pros, cons, tags,
  rating_academics, rating_campus, rating_accommodation, rating_cost,
  rating_intl_office, rating_social, rating_extracurricular, rating_career,
  created_at
)
SELECT u.id, NULL, v.rating, v.text, v.program, v.degree_level,
  v.enrollment_status, v.start_year, v.end_year, v.language_of_instruction,
  v.tuition_range, v.living_cost_range, v.funding_type, v.funding_coverage,
  v.recommend, v.pros, v.cons, v.tags,
  v.rating_academics, v.rating_campus, v.rating_accommodation, v.rating_cost,
  v.rating_intl_office, v.rating_social, v.rating_extracurricular, v.rating_career,
  v.created_at::timestamptz
FROM universities u
CROSS JOIN (VALUES
  -- 1. Long-form + everything filled: clamps AND shows all teaser chips
  (5,
   'Honestly, Tsinghua changed my life. I came for the engineering program and stayed for the people. The labs are genuinely world-class — I had access to equipment my home university could only dream of, and professors actually reply to emails within a day. The international office helped me through every bureaucratic nightmare: visa extensions, hukou registration, scholarship paperwork, all of it. Classes are demanding — expect 25+ hours of coursework a week — but the group projects with Chinese students were the highlight. Campus life is surprisingly vibrant: over 200 student clubs, a ridiculous number of free sports facilities, and the canteens are so cheap I ate three meals a day for under 30 RMB. If I had to pick one complaint, the winter air quality can get rough, and the dorm hot water schedule is a bit medieval. Still, I would choose Tsinghua again in a heartbeat and I recommend it to every international student who asks me.',
   'Computer Science', 'Master', 'alumni', 2021, 2024, 'English',
   '¥30k-40k', '¥3k-5k', 'csc', 'full', 'yes',
   'World-class labs and faculty, incredibly cheap canteens, huge international community, professors actually answer emails',
   'Brutal workload, dorm hot water is scheduled, winter air quality is rough',
   ARRAY['world-class', 'cheap-eats', 'demanding', 'great-support'],
   5, 5, 3, 5, 4, 5, 4, 4, '2025-06-10T00:00:00Z'),

  -- 2. Medium text + pros/cons + subscores
  (4,
   'Great program overall but definitely not for the faint of heart. The first semester hit me like a truck — the pace is much faster than European universities. That said, the support systems are excellent once you find them.',
   'Environmental Engineering', 'PhD', 'current', 2023, NULL, 'English',
   '¥40k+', '¥3k-5k', 'school', 'partial', 'yes',
   'Cutting-edge research facilities, generous stipend, beautiful campus',
   'Intense competition, limited English-taught electives',
   ARRAY['research-heavy', 'competitive'],
   5, 4, 4, 4, 3, 4, 3, 4, '2025-05-28T00:00:00Z'),

  -- 3. Short text, no extras — renders as a plain card, no button
  (5,
   'Best decision I ever made. The Chinese language program is intense but the teachers are patient and the campus is gorgeous.',
   'Chinese Language', 'Certificate', 'alumni', 2023, 2024, 'Chinese',
   NULL, NULL, NULL, NULL, 'yes', NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-05-20T00:00:00Z'),

  -- 4. Long text only — clamps with no teaser chips
  (3,
   'Mixed feelings about my time here. The academics were undeniably strong — Tsinghua''s economics faculty publishes constantly and the seminars bring in genuinely impressive guest speakers. But the experience for international students felt uneven. Some professors went out of their way to include us, while others lectured entirely in Chinese despite the program being advertised as English-taught. The bureaucracy was the real killer: every simple task required three offices, two stamps, and a week of waiting. The campus itself is undeniably beautiful, especially the lotus pond in summer, and Beijing is an incredible city to live in when the smog cooperates. I don''t regret going, but I went in with rose-tinted expectations and came out with a more nuanced picture. If you''re self-sufficient and already speak decent Chinese, you''ll thrive. If you expect hand-holding, look elsewhere.',
   'Economics', 'Bachelor', 'alumni', 2019, 2023, 'English',
   NULL, NULL, NULL, NULL, 'maybe', NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-05-15T00:00:00Z'),

  -- 5. Tags + one subscore only
  (4,
   'Solid exchange semester. Campus is huge — get a bike on day one.',
   'Mechanical Engineering', 'Bachelor', 'exchange', 2024, 2024, 'English',
   NULL, '¥3k-5k', NULL, NULL, 'yes',
   NULL, NULL, ARRAY['huge-campus', 'get-a-bike', 'exchange-friendly'],
   NULL, NULL, 4, NULL, NULL, NULL, 5, NULL, '2025-05-02T00:00:00Z'),

  -- 6. Pros only + ratings
  (5,
   'The scholarship support here is unmatched. CSC covered everything and the university topped it up with a living stipend. I literally saved money while studying abroad.',
   'Public Policy', 'Master', 'current', 2024, NULL, 'English',
   '¥30k-40k', '¥5k-8k', 'csc', 'full', 'yes',
   'Full funding, extra stipend, great international student office',
   NULL, ARRAY['fully-funded'],
   4, 4, 4, 5, 5, 4, NULL, 4, '2025-04-22T00:00:00Z'),

  -- 7. Cons only — tests the branched "Cons" chip
  (2,
   'Looks great on paper but the reality for undergrads is different. Most resources go to grad students.',
   'Physics', 'Bachelor', 'alumni', 2020, 2024, 'Chinese',
   NULL, NULL, 'self', NULL, 'no',
   NULL,
   'Undergrads are low priority, English support is minimal, housing lottery is a gamble',
   ARRAY['undergrad-unfriendly'],
   4, 3, 2, 4, 2, 3, 3, 2, '2025-04-10T00:00:00Z'),

  -- 8. Facts row heavy: costs + funding + language
  (4,
   'Did my whole MBA here and the ROI was excellent. The alumni network in Beijing finance is genuinely powerful — doors open just from the name.',
   'MBA', 'Master', 'alumni', 2020, 2022, 'English',
   '¥40k+', '¥5k-8k', 'self', NULL, 'yes',
   'Powerful alumni network, strong career services',
   'Expensive tuition, competitive atmosphere',
   ARRAY['networking', 'finance-pipeline', 'expensive'],
   4, 4, 3, 3, 4, 4, 4, 5, '2025-03-30T00:00:00Z'),

  -- 9. Long text + media teaser (image)
  (4,
   'Spent two years here on exchange and I still miss the campus. My photos don''t do it justice — the combination of traditional Chinese gardens next to glass research towers is something you have to see. The sports facilities were a highlight: an Olympic-size pool, brand new gym, and evening basketball games that ran until midnight. Academically it was rigorous but fair. The one thing I wish someone had told me earlier: join clubs in your first week. That''s where the real social life happens, especially for internationals who don''t speak Chinese yet. The buddy program paired me with a local student who became one of my closest friends.',
   'Architecture', 'Bachelor', 'exchange', 2022, 2024, 'English',
   NULL, '¥3k-5k', NULL, NULL, 'yes',
   'Stunning campus, amazing sports facilities, buddy program works',
   'Club recruitment is competitive, some dorms are dated',
   ARRAY['beautiful-campus', 'sports', 'social-life'],
   4, 5, 3, 4, 3, 5, 5, 4, '2025-03-18T00:00:00Z'),

  -- 10. Short + subscores only
  (3,
   'Average experience. Good school, impersonal vibe.',
   'Data Science', 'Master', 'current', 2024, NULL, 'English',
   NULL, NULL, NULL, NULL, 'maybe', NULL, NULL, NULL,
   4, 3, 3, 4, 3, 2, 3, 3, '2025-03-05T00:00:00Z'),

  -- 11. Applicant review
  (4,
   'Visited for the open day and the campus blew me away. Application process was smooth and the international office answered every question within a day.',
   NULL, 'Bachelor', 'applicant', NULL, NULL, NULL,
   '¥30k-40k', '¥3k-5k', 'school', 'full', 'yes',
   'Responsive admissions, gorgeous campus',
   NULL, ARRAY['open-day', 'responsive'],
   NULL, 5, NULL, NULL, 5, NULL, NULL, NULL, '2025-02-20T00:00:00Z'),

  -- 12. Negative long review
  (2,
   'I want to be fair because Tsinghua is objectively a top university, but my personal experience was disappointing. I came for an English-taught master''s and found that three of my core courses were quietly switched to Chinese instruction in the second week. The international office shrugged and suggested I "learn faster." My Chinese classmates were friendly but the social separation between international and domestic students is real — different dorms, different canteens even. The academic quality of the English-language electives was inconsistent; some were clearly designed for foreigners and graded on a much softer curve, which felt patronizing. Beijing itself is an amazing city and I don''t regret the adventure, but if you''re comparing programs, ask very specific questions about the actual language of instruction for EVERY course before you commit.',
   'International Relations', 'Master', 'alumni', 2022, 2024, 'English',
   '¥30k-40k', '¥5k-8k', 'self', NULL, 'no',
   'Beijing is incredible, strong brand name on CV',
   'Courses quietly switched to Chinese, social segregation, inconsistent English electives',
   ARRAY['language-bait', 'segregated-social'],
   3, 4, 3, 4, 2, 2, 3, 3, '2025-02-01T00:00:00Z')
) AS v(
  rating, text, program, degree_level, enrollment_status, start_year, end_year,
  language_of_instruction, tuition_range, living_cost_range, funding_type,
  funding_coverage, recommend, pros, cons, tags, rating_academics,
  rating_campus, rating_accommodation, rating_cost, rating_intl_office,
  rating_social, rating_extracurricular, rating_career, created_at
)
WHERE u.slug = 'tsinghua-university';
