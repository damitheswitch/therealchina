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
  ('Tsinghua University', '清华大学', 'Beijing', 'China', 'Beijing', 'comprehensive', 'tsinghua-university', '{tsinghua,thu,qinghua}', 'https://www.shanghairanking.cn/_uni/logo/27532357.png', false, 'public', '{Chinese,English}', 'https://www.tsinghua.edu.cn/en/', '{"shanghai_national": 1, "shanghai_url": "https://www.shanghairanking.cn/institution/tsinghua-university"}'),
  ('Peking University', '北京大学', 'Beijing', 'China', 'Beijing', 'comprehensive', 'peking-university', '{peking,pku,beida}', 'https://www.shanghairanking.cn/_uni/logo/86350223.png', false, 'public', '{Chinese,English}', 'https://english.pku.edu.cn/', '{"shanghai_national": 2, "shanghai_url": "https://www.shanghairanking.cn/institution/peking-university"}'),
  ('Fudan University', '复旦大学', 'Shanghai', 'China', 'Shanghai', 'comprehensive', 'fudan-university', '{fudan}', 'https://www.shanghairanking.cn/_uni/logo/28312850.png', false, 'public', '{Chinese,English}', 'https://www.fudan.edu.cn/en/', '{"shanghai_national": 5, "shanghai_url": "https://www.shanghairanking.cn/institution/fudan-university"}'),
  ('Shanghai Jiao Tong University', '上海交通大学', 'Shanghai', 'China', 'Shanghai', 'comprehensive', 'shanghai-jiao-tong-university', '{sjtu}', 'https://www.shanghairanking.cn/_uni/logo/27403919.png', false, 'public', '{Chinese,English}', 'https://en.sjtu.edu.cn/', '{"shanghai_national": 4, "shanghai_url": "https://www.shanghairanking.cn/institution/shanghai-jiao-tong-university"}'),
  ('Zhejiang University', '浙江大学', 'Hangzhou', 'China', 'Zhejiang', 'comprehensive', 'zhejiang-university', '{zju,zhejiang,zheda}', 'https://www.shanghairanking.cn/_uni/logo/88311656.png', false, 'public', '{Chinese,English}', 'https://www.zju.edu.cn/english/', '{"shanghai_national": 3, "shanghai_url": "https://www.shanghairanking.cn/institution/zhejiang-university"}'),
  ('Wuhan University', '武汉大学', 'Wuhan', 'China', 'Hubei', 'comprehensive', 'wuhan-university', '{whu,wuhan,wuda}', 'https://www.shanghairanking.cn/_uni/logo/46182017.png', false, 'public', '{Chinese,English}', 'https://en.whu.edu.cn/', '{"shanghai_national": 8, "shanghai_url": "https://www.shanghairanking.cn/institution/wuhan-university"}'),
  ('Sichuan University', '四川大学', 'Chengdu', 'China', 'Sichuan', 'comprehensive', 'sichuan-university', '{scu}', 'https://www.shanghairanking.cn/_uni/logo/75651370.png', false, 'public', '{Chinese}', 'https://en.scu.edu.cn/', '{"shanghai_national": 15, "shanghai_url": "https://www.shanghairanking.cn/institution/sichuan-university"}'),
  ('Xiamen University', '厦门大学', 'Xiamen', 'China', 'Fujian', 'comprehensive', 'xiamen-university', '{xmu,xiada}', 'https://www.shanghairanking.cn/_uni/logo/14008229.png', false, 'public', '{Chinese,English}', 'https://en.xmu.edu.cn/', '{"shanghai_national": 24, "shanghai_url": "https://www.shanghairanking.cn/institution/xiamen-university"}'),
  ('Nanjing University', '南京大学', 'Nanjing', 'China', 'Jiangsu', 'comprehensive', 'nanjing-university', '{nju,nanda}', 'https://www.shanghairanking.cn/_uni/logo/44696062.png', false, 'public', '{Chinese,English}', 'https://www.nju.edu.cn/en/', '{"shanghai_national": 6, "shanghai_url": "https://www.shanghairanking.cn/institution/nanjing-university"}'),
  ('Hunan University', '湖南大学', 'Changsha', 'China', 'Hunan', 'comprehensive', 'hunan-university', '{hnu}', 'https://www.shanghairanking.cn/_uni/logo/79015808.png', false, 'public', '{Chinese}', 'https://www.hnu.edu.cn/', '{"shanghai_national": 29, "shanghai_url": "https://www.shanghairanking.cn/institution/hunan-university"}'),
  ('Tianjin University', '天津大学', 'Tianjin', 'China', 'Tianjin', 'comprehensive', 'tianjin-university', '{tju}', 'https://www.shanghairanking.cn/_uni/logo/74813674.png', false, 'public', '{Chinese,English}', 'https://www.tju.edu.cn/english/', '{"shanghai_national": 20, "shanghai_url": "https://www.shanghairanking.cn/institution/tianjin-university"}'),
  ('Beihang University', '北京航空航天大学', 'Beijing', 'China', 'Beijing', 'stem', 'beihang-university', '{buaa,beihang}', 'https://www.shanghairanking.cn/_uni/logo/22403670.png', false, 'public', '{Chinese,English}', 'https://ev.buaa.edu.cn/', '{"shanghai_national": 11, "shanghai_url": "https://www.shanghairanking.cn/institution/beihang-university"}'),
  -- Real uni in Zhangye, Gansu whose true city is unknown in our dataset —
  -- exercises the province-only (NULL city) rendering path.
  ('Hexi University', '河西学院', NULL, 'China', 'Gansu', 'comprehensive', 'hexi-university', '{}', 'https://www.shanghairanking.cn/_uni/logo/84218792.png', false, 'public', '{Chinese}', NULL, '{}'),
  -- Off the 软科 main list: ranked #7 in the separate 中国中医药大学排名 2026
  -- (127 = 全国参考排名 national reference rank; list rank rides in shanghai_tcm).
  ('Zhejiang Chinese Medical University', '浙江中医药大学', 'Hangzhou', 'China', 'Zhejiang', 'medicine', 'zhejiang-chinese-medical-university', '{zcmu,zjcmu}', 'https://www.shanghairanking.cn/_uni/logo/35945029.png', false, NULL, '{}', 'https://www.zcmu.edu.cn/', '{"shanghai_national": 127, "shanghai_url": "https://www.shanghairanking.cn/institution/zhejiang-chinese-medical-university", "shanghai_score": 214.2, "shanghai_tcm": 7}')
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
-- 3b. DEMO USERS, QUESTIONS AND FLIGHTS
-- ============================================
-- Local/staging only, never prod. Keep in sync with supabase/seed_demo.sql.
-- ---- 5a. Demo users + profiles (flight owners and question authors) ----
-- Fixed ids, no password (cannot sign in). Reserved .invalid email domain.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'd0e0c0de-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'demo-amina@demo.invalid', '', NOW(), '{"provider":"email","providers":["email"]}', '{"display_name":"Amina"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'd0e0c0de-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'demo-chidi@demo.invalid', '', NOW(), '{"provider":"email","providers":["email"]}', '{"display_name":"Chidi"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'd0e0c0de-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'demo-daniyar@demo.invalid', '', NOW(), '{"provider":"email","providers":["email"]}', '{"display_name":"Daniyar"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'd0e0c0de-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'demo-rizky@demo.invalid', '', NOW(), '{"provider":"email","providers":["email"]}', '{"display_name":"Rizky"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'd0e0c0de-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'demo-bilal@demo.invalid', '', NOW(), '{"provider":"email","providers":["email"]}', '{"display_name":"Bilal"}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- handle_new_user() creates a bare profile; fill in the demo details.
INSERT INTO public.profiles (
  id, display_name, home_country, current_status, social_handles,
  is_discoverable, onboarding_completed
)
VALUES
  ('d0e0c0de-0000-4000-8000-000000000001', 'Amina', 'Morocco', 'studying', '[{"platform":"instagram","handle":"demo_amina"}]'::jsonb, true, true),
  ('d0e0c0de-0000-4000-8000-000000000002', 'Chidi', 'Nigeria', 'studying', '[{"platform":"instagram","handle":"demo_chidi"}]'::jsonb, true, true),
  ('d0e0c0de-0000-4000-8000-000000000003', 'Daniyar', 'Kazakhstan', 'studying', '[{"platform":"telegram","handle":"demo_daniyar"}]'::jsonb, true, true),
  ('d0e0c0de-0000-4000-8000-000000000004', 'Rizky', 'Indonesia', 'studying', '[{"platform":"instagram","handle":"demo_rizky"}]'::jsonb, true, true),
  ('d0e0c0de-0000-4000-8000-000000000005', 'Bilal', 'Pakistan', 'studying', '[{"platform":"instagram","handle":"demo_bilal"}]'::jsonb, true, true)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  home_country = EXCLUDED.home_country,
  current_status = EXCLUDED.current_status,
  social_handles = EXCLUDED.social_handles,
  is_discoverable = true,
  onboarding_completed = true;

-- ---- 5b. Demo community questions (all unanswered) ----
-- University is looked up by slug; a missing slug just leaves it NULL.
INSERT INTO public.qa_questions (
  id, slug, title, body, category, city, university_id, author_id, created_at
)
VALUES
  ('d0e0c0de-1000-4000-8000-000000000001', 'demo-dorm-curfew-international-students',
   'Is there a dorm curfew for international students at Tsinghua?',
   'I got my admission letter and I am trying to plan my first weeks. Someone told me the international dorms lock the gate at night. Is that true, and what happens if you come back late? I will be doing evening lab sessions so it matters to me.',
   'housing', 'Beijing', (SELECT id FROM public.universities WHERE slug = 'tsinghua-university'),
   'd0e0c0de-0000-4000-8000-000000000001', NOW() - INTERVAL '2 days'),
  ('d0e0c0de-1000-4000-8000-000000000002', 'demo-csc-scholarship-timeline-first-payment',
   'When does the first CSC scholarship payment actually arrive?',
   'I start at Fudan in September on a CSC scholarship. My seniors say the stipend can take two months to start. How much cash should I bring so I can cover rent and food until then?',
   'money', 'Shanghai', (SELECT id FROM public.universities WHERE slug = 'fudan-university'),
   'd0e0c0de-0000-4000-8000-000000000002', NOW() - INTERVAL '4 days'),
  ('d0e0c0de-1000-4000-8000-000000000003', 'demo-bank-card-without-chinese-phone-number',
   'Can I open a Chinese bank card without a local phone number?',
   'I land next week and have not bought a SIM yet. The bank near my dorm asked for a Chinese number last time I asked. Is there a bank that lets you open an account first and add the number later?',
   'money', 'Hangzhou', (SELECT id FROM public.universities WHERE slug = 'zhejiang-university'),
   'd0e0c0de-0000-4000-8000-000000000003', NOW() - INTERVAL '6 days'),
  ('d0e0c0de-1000-4000-8000-000000000004', 'demo-part-time-work-rules-student-visa',
   'What are the real rules for part-time work on a student visa?',
   'I would like to tutor English a few hours a week. The school says students need written permission, but a friend says nobody asks. What is the actual process and what are the risks if you skip it?',
   'work', 'Beijing', (SELECT id FROM public.universities WHERE slug = 'peking-university'),
   'd0e0c0de-0000-4000-8000-000000000004', NOW() - INTERVAL '9 days'),
  ('d0e0c0de-1000-4000-8000-000000000005', 'demo-student-health-insurance-claims',
   'How do claims work with the compulsory student health insurance?',
   'I paid for the insurance at registration, but I am not sure what it covers. If I go to a hospital outside campus, do I pay first and get the money back later? Does anyone have a receipt example?',
   'health', 'Hangzhou', (SELECT id FROM public.universities WHERE slug = 'zhejiang-university'),
   'd0e0c0de-0000-4000-8000-000000000005', NOW() - INTERVAL '12 days'),
  ('d0e0c0de-1000-4000-8000-000000000006', 'demo-alipay-setup-foreign-passport',
   'Alipay keeps rejecting my passport, what am I doing wrong?',
   'I verified my name and passport number but the app says my identity cannot be confirmed. I do have a Chinese number now. Do I need a bank card linked first, or is there another step for foreigners?',
   'tech', 'Shanghai', (SELECT id FROM public.universities WHERE slug = 'fudan-university'),
   'd0e0c0de-0000-4000-8000-000000000001', NOW() - INTERVAL '15 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.qa_question_votes (user_id, question_id)
VALUES
  ('d0e0c0de-0000-4000-8000-000000000002', 'd0e0c0de-1000-4000-8000-000000000001'),
  ('d0e0c0de-0000-4000-8000-000000000003', 'd0e0c0de-1000-4000-8000-000000000001'),
  ('d0e0c0de-0000-4000-8000-000000000004', 'd0e0c0de-1000-4000-8000-000000000001'),
  ('d0e0c0de-0000-4000-8000-000000000001', 'd0e0c0de-1000-4000-8000-000000000003'),
  ('d0e0c0de-0000-4000-8000-000000000004', 'd0e0c0de-1000-4000-8000-000000000003'),
  ('d0e0c0de-0000-4000-8000-000000000005', 'd0e0c0de-1000-4000-8000-000000000004'),
  ('d0e0c0de-0000-4000-8000-000000000002', 'd0e0c0de-1000-4000-8000-000000000006')
ON CONFLICT DO NOTHING;

-- ---- 5c. Demo upcoming flights (dates relative to today) ----
INSERT INTO public.flight_listings (
  id, user_id, departure_country, arrival_country, departure_city, arrival_city,
  departure_date, arrival_date, available_kgs, price_per_kg, currency, notes, is_active
)
VALUES
  ('d0e0c0de-2000-4000-8000-000000000001', 'd0e0c0de-0000-4000-8000-000000000001', 'Morocco', 'China', 'Casablanca', 'Beijing',
   CURRENT_DATE + 5, CURRENT_DATE + 6, 18, 60, 'CNY', 'Documents and small parcels only. Meet at the airport.', true),
  ('d0e0c0de-2000-4000-8000-000000000002', 'd0e0c0de-0000-4000-8000-000000000002', 'Nigeria', 'China', 'Lagos', 'Guangzhou',
   CURRENT_DATE + 14, CURRENT_DATE + 15, 25, 75, 'CNY', NULL, true),
  ('d0e0c0de-2000-4000-8000-000000000003', 'd0e0c0de-0000-4000-8000-000000000003', 'Kazakhstan', 'China', 'Almaty', 'Shanghai',
   CURRENT_DATE + 26, CURRENT_DATE + 26, 12, 50, 'CNY', 'Direct flight, one carry-on bag of space.', true),
  ('d0e0c0de-2000-4000-8000-000000000004', 'd0e0c0de-0000-4000-8000-000000000004', 'China', 'Indonesia', 'Shanghai', 'Jakarta',
   CURRENT_DATE + 40, CURRENT_DATE + 40, 20, 45, 'CNY', NULL, true)
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
