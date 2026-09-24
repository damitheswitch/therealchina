-- ============================================
-- TRC Seed Data (Phase 1)
-- 12 Universities + 10 Reviews
-- ============================================

-- ============================================
-- 1. UNIVERSITIES
-- ============================================
-- rankings: ShanghaiRanking (软科) national list positions + institution
-- page links; province/uni_category in English (merge script keeps these
-- in sync with the scraped list).
INSERT INTO universities (name, name_zh, city, country, province, uni_category, slug, slug_aliases, logo_url, is_verified, uni_type, languages_of_instruction, website, rankings)
VALUES
  ('Tsinghua University', '清华大学', 'Beijing', 'China', 'Beijing', 'comprehensive', 'tsinghua-university', '{tsinghua}', 'https://www.shanghairanking.cn/_uni/logo/27532357.png', false, 'public', '{Chinese,English}', 'https://www.tsinghua.edu.cn/en/', '{"shanghai_national": 1, "shanghai_url": "https://www.shanghairanking.cn/institution/tsinghua-university"}'),
  ('Peking University', '北京大学', 'Beijing', 'China', 'Beijing', 'comprehensive', 'peking-university', '{peking}', 'https://www.shanghairanking.cn/_uni/logo/86350223.png', false, 'public', '{Chinese,English}', 'https://english.pku.edu.cn/', '{"shanghai_national": 2, "shanghai_url": "https://www.shanghairanking.cn/institution/peking-university"}'),
  ('Fudan University', '复旦大学', 'Shanghai', 'China', 'Shanghai', 'comprehensive', 'fudan-university', '{fudan}', 'https://www.shanghairanking.cn/_uni/logo/28312850.png', false, 'public', '{Chinese,English}', 'https://www.fudan.edu.cn/en/', '{"shanghai_national": 5, "shanghai_url": "https://www.shanghairanking.cn/institution/fudan-university"}'),
  ('Shanghai Jiao Tong University', '上海交通大学', 'Shanghai', 'China', 'Shanghai', 'comprehensive', 'shanghai-jiao-tong-university', '{sjtu}', 'https://www.shanghairanking.cn/_uni/logo/27403919.png', false, 'public', '{Chinese,English}', 'https://en.sjtu.edu.cn/', '{"shanghai_national": 4, "shanghai_url": "https://www.shanghairanking.cn/institution/shanghai-jiao-tong-university"}'),
  ('Zhejiang University', '浙江大学', 'Hangzhou', 'China', 'Zhejiang', 'comprehensive', 'zhejiang-university', '{zju,zhejiang}', 'https://www.shanghairanking.cn/_uni/logo/88311656.png', false, 'public', '{Chinese,English}', 'https://www.zju.edu.cn/english/', '{"shanghai_national": 3, "shanghai_url": "https://www.shanghairanking.cn/institution/zhejiang-university"}'),
  ('Wuhan University', '武汉大学', 'Wuhan', 'China', 'Hubei', 'comprehensive', 'wuhan-university', '{whu,wuhan}', 'https://www.shanghairanking.cn/_uni/logo/46182017.png', false, 'public', '{Chinese,English}', 'https://en.whu.edu.cn/', '{"shanghai_national": 8, "shanghai_url": "https://www.shanghairanking.cn/institution/wuhan-university"}'),
  ('Sichuan University', '四川大学', 'Chengdu', 'China', 'Sichuan', 'comprehensive', 'sichuan-university', '{scu}', 'https://www.shanghairanking.cn/_uni/logo/75651370.png', false, 'public', '{Chinese}', 'https://en.scu.edu.cn/', '{"shanghai_national": 15, "shanghai_url": "https://www.shanghairanking.cn/institution/sichuan-university"}'),
  ('Xiamen University', '厦门大学', 'Xiamen', 'China', 'Fujian', 'comprehensive', 'xiamen-university', '{xmu}', 'https://www.shanghairanking.cn/_uni/logo/14008229.png', false, 'public', '{Chinese,English}', 'https://en.xmu.edu.cn/', '{"shanghai_national": 24, "shanghai_url": "https://www.shanghairanking.cn/institution/xiamen-university"}'),
  ('Nanjing University', '南京大学', 'Nanjing', 'China', 'Jiangsu', 'comprehensive', 'nanjing-university', '{nju}', 'https://www.shanghairanking.cn/_uni/logo/44696062.png', false, 'public', '{Chinese,English}', 'https://www.nju.edu.cn/en/', '{"shanghai_national": 6, "shanghai_url": "https://www.shanghairanking.cn/institution/nanjing-university"}'),
  ('Hunan University', '湖南大学', 'Changsha', 'China', 'Hunan', 'comprehensive', 'hunan-university', '{hnu}', 'https://www.shanghairanking.cn/_uni/logo/79015808.png', false, 'public', '{Chinese}', 'https://www.hnu.edu.cn/', '{"shanghai_national": 29, "shanghai_url": "https://www.shanghairanking.cn/institution/hunan-university"}'),
  ('Tianjin University', '天津大学', 'Tianjin', 'China', 'Tianjin', 'comprehensive', 'tianjin-university', '{tju}', 'https://www.shanghairanking.cn/_uni/logo/74813674.png', false, 'public', '{Chinese,English}', 'https://www.tju.edu.cn/english/', '{"shanghai_national": 20, "shanghai_url": "https://www.shanghairanking.cn/institution/tianjin-university"}'),
  ('Beihang University', '北京航空航天大学', 'Beijing', 'China', 'Beijing', 'stem', 'beihang-university', '{buaa}', 'https://www.shanghairanking.cn/_uni/logo/22403670.png', false, 'public', '{Chinese,English}', 'https://ev.buaa.edu.cn/', '{"shanghai_national": 11, "shanghai_url": "https://www.shanghairanking.cn/institution/beihang-university"}')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 2. REVIEWS
-- ============================================
-- Note: Reviews use NULL user_id for anonymous submissions
INSERT INTO reviews (university_id, user_id, rating, text, program, degree_level, created_at)
VALUES
  -- Tsinghua reviews
  ((SELECT id FROM universities WHERE slug = 'tsinghua' OR 'tsinghua' = ANY(slug_aliases)), NULL, 5,
   'The campus is stunning and the engineering faculty is world-class. Professors genuinely care about international students and there are tons of English-taught programs. The dorm situation is tight but manageable.',
   'Computer Science', 'Master', '2025-03-14T00:00:00Z'),

  ((SELECT id FROM universities WHERE slug = 'tsinghua' OR 'tsinghua' = ANY(slug_aliases)), NULL, 4,
   'Great academics, but the workload is no joke. Be prepared to study hard. The international office was helpful with my visa extension though.',
   'Environmental Engineering', 'PhD', '2025-01-22T00:00:00Z'),

  -- Peking review
  ((SELECT id FROM universities WHERE slug = 'peking' OR 'peking' = ANY(slug_aliases)), NULL, 5,
   'PKU has the most beautiful campus I have ever seen — Weiming Lake in autumn is unreal. The Chinese language program for international students is excellent and very affordable.',
   'Chinese Language', 'Certificate', '2025-04-02T00:00:00Z'),

  -- Fudan review
  ((SELECT id FROM universities WHERE slug = 'fudan' OR 'fudan' = ANY(slug_aliases)), NULL, 4,
   'Shanghai life is unbeatable. Fudan has strong international programs and the career fairs are well-connected. Cafeteria food could be better but there are cheap eats everywhere nearby.',
   'International Relations', 'Bachelor', '2025-02-11T00:00:00Z'),

  -- Wuhan review
  ((SELECT id FROM universities WHERE slug = 'whu' OR 'whu' = ANY(slug_aliases)), NULL, 5,
   'Wuhan University during cherry blossom season is one of the most beautiful places on earth. The sociology department is very welcoming to international researchers.',
   'Sociology', 'PhD', '2025-03-28T00:00:00Z'),

  -- Zhejiang review
  ((SELECT id FROM universities WHERE slug = 'zju' OR 'zju' = ANY(slug_aliases)), NULL, 4,
   'Zhejiang has a huge campus in Hangzhou with great facilities. The CS program is competitive but the professors are approachable. Close to Alibaba HQ which means good internship opportunities.',
   'Data Science', 'Master', '2025-01-15T00:00:00Z'),

  -- Xiamen review
  ((SELECT id FROM universities WHERE slug = 'xmu' OR 'xmu' = ANY(slug_aliases)), NULL, 5,
   'Xiamen University is right on the beach — literally. The architecture is gorgeous, the seafood is cheap, and the people are warm. One of the most underrated campuses in China.',
   'Marine Biology', 'Bachelor', '2025-04-10T00:00:00Z'),

  -- Sichuan review
  ((SELECT id FROM universities WHERE slug = 'scu' OR 'scu' = ANY(slug_aliases)), NULL, 3,
   'Sichuan University has good medical programs but the international student support was hit or miss. Chengdu itself is amazing though — the food scene is incredible and rent is very affordable.',
   'Clinical Medicine', 'Bachelor', '2024-12-20T00:00:00Z'),

  -- Shanghai Jiao Tong review
  ((SELECT id FROM universities WHERE slug = 'sjtu' OR 'sjtu' = ANY(slug_aliases)), NULL, 4,
   'SJTU has a massive, modern campus in Minhang. The engineering labs are top-notch. Commute to downtown Shanghai is long but the campus itself has everything you need.',
   'Mechanical Engineering', 'Master', '2025-02-28T00:00:00Z'),

  -- Nanjing review
  ((SELECT id FROM universities WHERE slug = 'nju' OR 'nju' = ANY(slug_aliases)), NULL, 4,
   'Nanjing University has a strong liberal arts tradition. The history department is fantastic and the city of Nanjing is rich in culture. Cost of living is much lower than Beijing or Shanghai.',
   'History', 'PhD', '2025-03-05T00:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. DEMO REVIEWS
-- ============================================
-- Six rich anonymous reviews with media placeholders — exercises the
-- review-summary card, recommend pill, and photo strip. Resolved by slug,
-- so they only land where the university exists.
-- Keep this block in sync with supabase/seed_demo.sql (the standalone
-- copy used to reseed staging manually).
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
        {"url": "/media/demo/trc-tsinghua-quad.jpg", "type": "image", "name": "main-quad.jpg"},
        {"url": "/media/demo/trc-tsinghua-lib.jpg", "type": "image", "name": "library.jpg"},
        {"url": "/media/demo/trc-tsinghua-dorm.jpg", "type": "image", "name": "dorm.jpg"},
        {"url": "/media/demo/trc-tsinghua-gate.jpg", "type": "image", "name": "gate.jpg"},
        {"url": "/media/demo/trc-tsinghua-lake.jpg", "type": "image", "name": "lake.jpg"}
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
      NULL,  3, NULL, 5,
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
        {"url": "/media/demo/trc-tsinghua-canteen.jpg", "type": "image", "name": "canteen.jpg"}]'::jsonb,
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
        {"url": "/media/demo/trc-fudan-street.jpg", "type": "image", "name": "street-food.jpg"},
        {"url": "/media/demo/trc-fudan-river.jpg", "type": "image", "name": "suzhou-creek.jpg"}
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
JOIN public.universities u ON u.slug = v.uni_slug OR v.uni_slug = ANY(u.slug_aliases)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. NOTES
-- ============================================
-- university_stats is maintained by database triggers on reviews.
-- No refresh step is required after seeding.
--
-- Upvotes are not seeded because they require real auth.users records
-- (user_id FK is NOT NULL). Upvotes will be created during testing by
-- authenticated users via the toggle_upvote RPC.

-- ============================================
-- COMPLETED
-- ============================================
