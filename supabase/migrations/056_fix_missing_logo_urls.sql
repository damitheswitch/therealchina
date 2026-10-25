-- Fix logo_url for 4 universities. hexi/luliang/applied-jiangxi had NULL or
-- empty logo_url (rendered the letter tile). yangtze-river pointed at
-- logo-jpg/4406712200.jpg, whose upstream asset is corrupted (scan-line
-- streaks) — SR serves a clean version as logo/44067122.png. All four logo
-- files ship first-party under /logos/ in the same deploy (logo-jpg URLs
-- map to the converted /logos/<id>.png). Idempotent: no-op where already
-- fixed. Slug coverage mirrors seed_merge (rows may carry either the
-- seed.sql or seed_universities slug).
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/84218792.png'
  WHERE (slug = 'hexi' OR slug = 'hexi-university' OR slug_aliases @> '{hexi}' OR slug_aliases @> '{hexi-university}')
    AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/84218792.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/57608847.png'
  WHERE (slug = 'luliang' OR slug_aliases @> '{luliang}')
    AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/57608847.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/74855408.png'
  WHERE (slug = 'applied-jiangxi' OR slug_aliases @> '{applied-jiangxi}')
    AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/74855408.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/44067122.png'
  WHERE (slug = 'yangtze-river' OR slug_aliases @> '{yangtze-river}')
    AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/44067122.png';
-- pingxiang: repoint from the opaque white-on-maroon square (logo/24745412)
-- to the transparent maroon-seal variant (logo-jpg/2474541200, converted to
-- a transparent PNG) so it renders like every other logo.
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo-jpg/2474541200.jpg'
  WHERE (slug = 'pingxiang' OR slug_aliases @> '{pingxiang}')
    AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo-jpg/2474541200.jpg';
