-- Fix legacy logo_url values left over from the pre-ShanghaiRanking dataset.
-- These 10 rows still carried Pexels photo URLs (or empty strings) because
-- seed_merge.sql updates name/rankings/aliases but deliberately skips logo_url
-- for matched rows. Since 4c1b322 the frontend only renders first-party
-- mirrored /logos/* (mapped from shanghairanking.cn URLs) — anything else falls
-- back to the letter tile, so these unis showed no logo on prod.
-- Values match what staging already has. Idempotent: no-op where already fixed.
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/27532357.png'
  WHERE slug = 'tsinghua-university' AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/27532357.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/86350223.png'
  WHERE slug = 'peking-university' AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/86350223.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/22403670.png'
  WHERE slug = 'beihang-university' AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/22403670.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/27403919.png'
  WHERE slug = 'shanghai-jiao-tong-university' AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/27403919.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/28312850.png'
  WHERE slug = 'fudan-university' AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/28312850.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/44696062.png'
  WHERE slug = 'nanjing-university' AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/44696062.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/75651370.png'
  WHERE slug = 'sichuan-university' AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/75651370.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/74813674.png'
  WHERE slug = 'tianjin-university' AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/74813674.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/14008229.png'
  WHERE slug = 'xiamen-university' AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/14008229.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/79015808.png'
  WHERE slug = 'hunan-university' AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/79015808.png';
