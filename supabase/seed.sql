-- ============================================
-- TRC Seed Data (Phase 1)
-- 12 Universities + 10 Reviews
-- ============================================

-- ============================================
-- 1. UNIVERSITIES
-- ============================================
INSERT INTO universities (name, name_zh, city, slug, logo_url, is_verified)
VALUES
  ('Tsinghua University', '清华大学', 'Beijing', 'tsinghua', 'https://images.pexels.com/photos/32384116/pexels-photo-32384116.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Peking University', '北京大学', 'Beijing', 'peking', 'https://images.pexels.com/photos/32421367/pexels-photo-32421367.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Fudan University', '复旦大学', 'Shanghai', 'fudan', 'https://images.pexels.com/photos/35052489/pexels-photo-35052489.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Shanghai Jiao Tong University', '上海交通大学', 'Shanghai', 'sjtu', 'https://images.pexels.com/photos/37137233/pexels-photo-37137233.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Zhejiang University', '浙江大学', 'Hangzhou', 'zju', 'https://images.pexels.com/photos/35564755/pexels-photo-35564755.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Wuhan University', '武汉大学', 'Wuhan', 'whu', 'https://images.pexels.com/photos/36949547/pexels-photo-36949547.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Sichuan University', '四川大学', 'Chengdu', 'scu', 'https://images.pexels.com/photos/37333836/pexels-photo-37333836.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Xiamen University', '厦门大学', 'Xiamen', 'xmu', 'https://images.pexels.com/photos/20265634/pexels-photo-20265634.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Nanjing University', '南京大学', 'Nanjing', 'nju', 'https://images.pexels.com/photos/19193975/pexels-photo-19193975.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Hunan University', '湖南大学', 'Changsha', 'hnu', 'https://images.pexels.com/photos/7883872/pexels-photo-7883872.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Tianjin University', '天津大学', 'Tianjin', 'tju', 'https://images.pexels.com/photos/37186801/pexels-photo-37186801.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false),
  ('Beihang University', '北京航空航天大学', 'Beijing', 'buaa', 'https://images.pexels.com/photos/36606325/pexels-photo-36606325.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', false)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 2. REVIEWS
-- ============================================
-- Note: Reviews use NULL user_id for anonymous submissions
INSERT INTO reviews (university_id, user_id, rating, text, program, degree_level, created_at)
VALUES
  -- Tsinghua reviews
  ((SELECT id FROM universities WHERE slug = 'tsinghua'), NULL, 5,
   'The campus is stunning and the engineering faculty is world-class. Professors genuinely care about international students and there are tons of English-taught programs. The dorm situation is tight but manageable.',
   'Computer Science', 'Master', '2025-03-14T00:00:00Z'),

  ((SELECT id FROM universities WHERE slug = 'tsinghua'), NULL, 4,
   'Great academics, but the workload is no joke. Be prepared to study hard. The international office was helpful with my visa extension though.',
   'Environmental Engineering', 'PhD', '2025-01-22T00:00:00Z'),

  -- Peking review
  ((SELECT id FROM universities WHERE slug = 'peking'), NULL, 5,
   'PKU has the most beautiful campus I have ever seen — Weiming Lake in autumn is unreal. The Chinese language program for international students is excellent and very affordable.',
   'Chinese Language', 'Certificate', '2025-04-02T00:00:00Z'),

  -- Fudan review
  ((SELECT id FROM universities WHERE slug = 'fudan'), NULL, 4,
   'Shanghai life is unbeatable. Fudan has strong international programs and the career fairs are well-connected. Cafeteria food could be better but there are cheap eats everywhere nearby.',
   'International Relations', 'Bachelor', '2025-02-11T00:00:00Z'),

  -- Wuhan review
  ((SELECT id FROM universities WHERE slug = 'whu'), NULL, 5,
   'Wuhan University during cherry blossom season is one of the most beautiful places on earth. The sociology department is very welcoming to international researchers.',
   'Sociology', 'PhD', '2025-03-28T00:00:00Z'),

  -- Zhejiang review
  ((SELECT id FROM universities WHERE slug = 'zju'), NULL, 4,
   'Zhejiang has a huge campus in Hangzhou with great facilities. The CS program is competitive but the professors are approachable. Close to Alibaba HQ which means good internship opportunities.',
   'Data Science', 'Master', '2025-01-15T00:00:00Z'),

  -- Xiamen review
  ((SELECT id FROM universities WHERE slug = 'xmu'), NULL, 5,
   'Xiamen University is right on the beach — literally. The architecture is gorgeous, the seafood is cheap, and the people are warm. One of the most underrated campuses in China.',
   'Marine Biology', 'Bachelor', '2025-04-10T00:00:00Z'),

  -- Sichuan review
  ((SELECT id FROM universities WHERE slug = 'scu'), NULL, 3,
   'Sichuan University has good medical programs but the international student support was hit or miss. Chengdu itself is amazing though — the food scene is incredible and rent is very affordable.',
   'Clinical Medicine', 'Bachelor', '2024-12-20T00:00:00Z'),

  -- Shanghai Jiao Tong review
  ((SELECT id FROM universities WHERE slug = 'sjtu'), NULL, 4,
   'SJTU has a massive, modern campus in Minhang. The engineering labs are top-notch. Commute to downtown Shanghai is long but the campus itself has everything you need.',
   'Mechanical Engineering', 'Master', '2025-02-28T00:00:00Z'),

  -- Nanjing review
  ((SELECT id FROM universities WHERE slug = 'nju'), NULL, 4,
   'Nanjing University has a strong liberal arts tradition. The history department is fantastic and the city of Nanjing is rich in culture. Cost of living is much lower than Beijing or Shanghai.',
   'History', 'PhD', '2025-03-05T00:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. REFRESH MATERIALIZED VIEW
-- ============================================
-- Upvotes are not seeded because they require real auth.users records
-- (user_id FK is NOT NULL). Upvotes will be created during testing by
-- authenticated users via the toggle_upvote RPC.
REFRESH MATERIALIZED VIEW university_stats;

-- ============================================
-- COMPLETED
-- ============================================
