-- seed_zjcmu.sql — Zhejiang Chinese Medical University (real row, all fields).
-- Applied manually per env like seed_aliases.sql; idempotent, safe to replay.
--
-- This school is not in the 软科 main list (bcur covers 综合/理工/师范/农业/林业
-- only). It ranks #7 in the separate 中国中医药大学排名 2026 (dataset 745, score
-- 214.2), with 全国参考排名 127 — stored as shanghai_national so the card sorts
-- and displays it; the TCM-list rank rides along as rankings->>'shanghai_tcm'.
-- ARWU 2026 is a band (501-600) and arwu_world expects a number, so omitted.
--
-- NOTE: logo_url is NULL on staging/prod until frontend/public/logos/35945029.png
-- ships in a deploy (the site serves first-party /logos/, never hotlinks SR).
-- Re-apply this file after the deploy lands to restore the logo.
INSERT INTO universities (name, name_zh, city, country, province, uni_category, slug, slug_aliases, logo_url, is_verified, uni_type, languages_of_instruction, website, rankings)
VALUES (
  'Zhejiang Chinese Medical University', '浙江中医药大学', 'Hangzhou', 'China', 'Zhejiang',
  'medicine', 'zhejiang-chinese-medical-university', '{zcmu,zjcmu}',
  'https://www.shanghairanking.cn/_uni/logo/35945029.png', false, NULL, '{}',
  'https://www.zcmu.edu.cn/',
  '{"shanghai_national": 127, "shanghai_url": "https://www.shanghairanking.cn/institution/zhejiang-chinese-medical-university", "shanghai_score": 214.2, "shanghai_tcm": 7}'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_zh = EXCLUDED.name_zh,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  province = EXCLUDED.province,
  uni_category = EXCLUDED.uni_category,
  slug_aliases = (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(universities.slug_aliases, EXCLUDED.slug_aliases)) x),
  logo_url = EXCLUDED.logo_url,
  website = EXCLUDED.website,
  rankings = universities.rankings || EXCLUDED.rankings;
