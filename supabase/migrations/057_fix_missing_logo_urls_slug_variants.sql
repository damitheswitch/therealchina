-- Forward fix for 056: its WHERE clauses matched the seed.sql/
-- seed_universities.sql slug forms but the merged production dataset
-- carries longer canonical slugs for three of the five rows
-- (luliang-university, pingxiang-university,
-- college-of-applied-science-jiangxi-university-of-science-and-technology),
-- which slipped through on the staging push. This covers every observed
-- slug and alias form, and matches the two repoints by bad logo_url
-- value too so the fix is slug-agnostic. Idempotent: IS DISTINCT FROM
-- makes re-application a no-op everywhere it already ran.
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/84218792.png'
  WHERE (slug IN ('hexi', 'hexi-university')
      OR slug_aliases && '{hexi,hexi-university}'::text[])
    AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/84218792.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/57608847.png'
  WHERE (slug IN ('luliang', 'luliang-university')
      OR slug_aliases && '{luliang,luliang-university}'::text[])
    AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/57608847.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/74855408.png'
  WHERE (slug IN ('applied-jiangxi',
                  'college-of-applied-science-jiangxi-university-of-science-and-technology',
                  'gannan-university-of-science-and-technology')
      OR slug_aliases && '{applied-jiangxi,college-of-applied-science-jiangxi-university-of-science-and-technology,gannan-university-of-science-and-technology}'::text[])
    AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/74855408.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo/44067122.png'
  WHERE (slug IN ('yangtze-river', 'east-china-institute-of-technology-yangtze-river-college')
      OR slug_aliases && '{yangtze-river,east-china-institute-of-technology-yangtze-river-college}'::text[]
      OR logo_url = 'https://www.shanghairanking.cn/_uni/logo-jpg/4406712200.jpg')
    AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo/44067122.png';
UPDATE universities SET logo_url = 'https://www.shanghairanking.cn/_uni/logo-jpg/2474541200.jpg'
  WHERE (slug IN ('pingxiang', 'pingxiang-university')
      OR slug_aliases && '{pingxiang,pingxiang-university}'::text[]
      OR logo_url = 'https://www.shanghairanking.cn/_uni/logo/24745412.png')
    AND logo_url IS DISTINCT FROM 'https://www.shanghairanking.cn/_uni/logo-jpg/2474541200.jpg';
