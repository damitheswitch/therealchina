-- Corrections over the uni dataset/Chinese_Universities.csv link column (upstream errors).
-- Unconditional UPDATE: envs that already got the wrong URL need the overwrite.
UPDATE universities SET website = 'https://www.cumtb.edu.cn/' WHERE slug = 'china-university-of-mining-and-technology-beijing';
UPDATE universities SET website = 'https://www.huse.edu.cn/' WHERE slug = 'hunan-university-of-science-and-engineering';
