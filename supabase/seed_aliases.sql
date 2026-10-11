-- seed_aliases.sql — adds common English abbreviations to universities.slug_aliases
-- Append-only, deduped; safe to replay on any env.
-- Canonical slug differs between envs for these two (staging 'zhejiang' /
-- 'wuhan', prod long-form) — match by slug or existing alias so the UPDATE
-- lands on either.
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{zju,zheda}')) x)
  WHERE slug = 'zhejiang' OR slug = 'zhejiang-university' OR 'zhejiang-university' = ANY(slug_aliases);
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{whu,wuda}')) x)
  WHERE slug = 'wuhan' OR slug = 'wuhan-university' OR 'wuhan-university' = ANY(slug_aliases);
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{pku,beida}')) x)
  WHERE slug = 'peking-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{thu,qinghua}')) x)
  WHERE slug = 'tsinghua-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nanda}')) x)
  WHERE slug = 'nanjing-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{beihang}')) x)
  WHERE slug = 'beihang-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{xiada}')) x)
  WHERE slug = 'xiamen-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{sdu}')) x)
  WHERE slug = 'shandong-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{renda}')) x)
  WHERE slug = 'renmin-university-of-china';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{bupt}')) x)
  WHERE slug = 'beijing-university-of-posts-and-telecommunications';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{bjtu}')) x)
  WHERE slug = 'beijing-jiaotong-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{bjut}')) x)
  WHERE slug = 'beijing-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{buct}')) x)
  WHERE slug = 'beijing-university-of-chemical-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cup,cupb}')) x)
  WHERE slug = 'china-university-of-petroleum-beijing';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{upc}')) x)
  WHERE slug = 'huadong';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cugb}')) x)
  WHERE slug = 'geosciences-beijing';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cug}')) x)
  WHERE slug = 'geosciences-wuhan';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cumt}')) x)
  WHERE slug = 'china-university-of-mining-and-technology-xuzhou';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cumtb}')) x)
  WHERE slug = 'china-university-of-mining-and-technology-beijing';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{uir}')) x)
  WHERE slug = 'university-of-international-relations';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ncepu}')) x)
  WHERE slug = 'north-china-electric-power-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ecjtu}')) x)
  WHERE slug = 'east-china-jiaotong-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{dmu}')) x)
  WHERE slug = 'dalian-maritime-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nefu}')) x)
  WHERE slug = 'northeast-forestry-university-china';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{neau}')) x)
  WHERE slug = 'northeast-agricultural-university-china';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nenu}')) x)
  WHERE slug = 'northeast-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hlju}')) x)
  WHERE slug = 'heilongjiang-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nwafu}')) x)
  WHERE slug = 'northwest-a-f-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{chd}')) x)
  WHERE slug = 'changan-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{xaut}')) x)
  WHERE slug = 'xian-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{xauat}')) x)
  WHERE slug = 'xian-university-of-architecture-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{xust}')) x)
  WHERE slug = 'xian-university-of-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{xsyu}')) x)
  WHERE slug = 'xian-shiyou-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nwu}')) x)
  WHERE slug = 'northwest-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{swu}')) x)
  WHERE slug = 'southwest-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{swpu}')) x)
  WHERE slug = 'southwest-petroleum-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cqupt}')) x)
  WHERE slug = 'chongqing-university-of-posts-and-telecommunications';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{whut}')) x)
  WHERE slug = 'wuhan-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{wust}')) x)
  WHERE slug = 'wuhan-university-of-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{wtu}')) x)
  WHERE slug = 'wuhan-textile-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{zzu}')) x)
  WHERE slug = 'zhengzhou-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{henu}')) x)
  WHERE slug = 'henan-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{haut}')) x)
  WHERE slug = 'henan-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hpu}')) x)
  WHERE slug = 'henan-polytechnic-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{henau}')) x)
  WHERE slug = 'henan-agricultural-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{htu}')) x)
  WHERE slug = 'henan-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nuist}')) x)
  WHERE slug = 'nanjing-university-of-information-science-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nupt}')) x)
  WHERE slug = 'nanjing-university-of-posts-and-telecommunications';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nust}')) x)
  WHERE slug = 'nanjing-university-of-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{njau}')) x)
  WHERE slug = 'nanjing-agricultural-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{njfu}')) x)
  WHERE slug = 'nanjing-forestry-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{njnu}')) x)
  WHERE slug = 'nanjing-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{njtech}')) x)
  WHERE slug = 'nanjing-tech-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hhu}')) x)
  WHERE slug = 'hohai-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ujs}')) x)
  WHERE slug = 'jiangsu-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{usts}')) x)
  WHERE slug = 'suzhou-university-of-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{suda}')) x)
  WHERE slug = 'soochow';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cczu}')) x)
  WHERE slug = 'changzhou-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{yzu}')) x)
  WHERE slug = 'yangzhou-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hdu}')) x)
  WHERE slug = 'hangzhou-dianzi-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hznu}')) x)
  WHERE slug = 'hangzhou-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nbu}')) x)
  WHERE slug = 'ningbo-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{zjnu}')) x)
  WHERE slug = 'zhejiang-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{zstu}')) x)
  WHERE slug = 'zhejiang-sci-tech-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{zafu}')) x)
  WHERE slug = 'zhejiang-a-f-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{fzu}')) x)
  WHERE slug = 'fuzhou-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hqu}')) x)
  WHERE slug = 'huaqiao-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hfut}')) x)
  WHERE slug = 'hefei-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ahu}')) x)
  WHERE slug = 'anhui-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ncu}')) x)
  WHERE slug = 'nanchang-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nchu}')) x)
  WHERE slug = 'nanchang-hangkong-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{jxnu}')) x)
  WHERE slug = 'jiangxi-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{gxu}')) x)
  WHERE slug = 'guangxi-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{guet}')) x)
  WHERE slug = 'guilin-university-of-electronic-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{glut}')) x)
  WHERE slug = 'guilin-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{scau}')) x)
  WHERE slug = 'south-china-agricultural-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{jnu}')) x)
  WHERE slug = 'jinan-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{szu}')) x)
  WHERE slug = 'shenzhen-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{gdut}')) x)
  WHERE slug = 'guangdong-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{gzhu}')) x)
  WHERE slug = 'guangzhou-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{dgut}')) x)
  WHERE slug = 'dongguan-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ynu}')) x)
  WHERE slug = 'yunnan-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{kust}')) x)
  WHERE slug = 'kunming-university-of-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{gzu}')) x)
  WHERE slug = 'guizhou-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cdut}')) x)
  WHERE slug = 'chengdu-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{sicnu}')) x)
  WHERE slug = 'sichuan-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{dhu}')) x)
  WHERE slug = 'donghua-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{usst}')) x)
  WHERE slug = 'university-of-shanghai-for-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{shiep}')) x)
  WHERE slug = 'shanghai-university-of-electric-power';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{tjnu}')) x)
  WHERE slug = 'tianjin-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{tust}')) x)
  WHERE slug = 'tianjin-university-of-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{tjut}')) x)
  WHERE slug = 'tianjin-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hebut}')) x)
  WHERE slug = 'hebei-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ysu}')) x)
  WHERE slug = 'yanshan-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{sxu}')) x)
  WHERE slug = 'shanxi-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{tyut}')) x)
  WHERE slug = 'taiyuan-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{imu}')) x)
  WHERE slug = 'inner-mongolia-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{nxu}')) x)
  WHERE slug = 'ningxia-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{qhu}')) x)
  WHERE slug = 'qinghai-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{xju}')) x)
  WHERE slug = 'xinjiang-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{xzu}')) x)
  WHERE slug = 'tibet-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{shzu}')) x)
  WHERE slug = 'shihezi-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ybu}')) x)
  WHERE slug = 'yanbian-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cust}')) x)
  WHERE slug = 'changchun-university-of-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{lnu}')) x)
  WHERE slug = 'liaoning-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ouc}')) x)
  WHERE slug = 'ocean-university-of-china';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{qdu}')) x)
  WHERE slug = 'qingdao-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{qut}')) x)
  WHERE slug = 'qingdao-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{sdust}')) x)
  WHERE slug = 'shandong-university-of-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{sdut}')) x)
  WHERE slug = 'shandong-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{sdau}')) x)
  WHERE slug = 'shandong-agricultural-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{qfnu}')) x)
  WHERE slug = 'qufu-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hubu}')) x)
  WHERE slug = 'hubei-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{csust}')) x)
  WHERE slug = 'changsha-university-of-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ctgu}')) x)
  WHERE slug = 'china-three-gorges-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{zzuli}')) x)
  WHERE slug = 'zhengzhou-university-of-light-industry';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{ecut}')) x)
  WHERE slug = 'east-china-university-of-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{jxau}')) x)
  WHERE slug = 'jiangxi-agricultural-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hunau}')) x)
  WHERE slug = 'hunan-agricultural-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hunnu}')) x)
  WHERE slug = 'hunan-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{xjau}')) x)
  WHERE slug = 'xinjiang-agricultural-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{syau}')) x)
  WHERE slug = 'shenyang-agricultural-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{qust}')) x)
  WHERE slug = 'qingdao-university-of-science-and-technology';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cnu}')) x)
  WHERE slug = 'capital-normal-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{tgu}')) x)
  WHERE slug = 'tiangong-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{hainu}')) x)
  WHERE slug = 'hainan-university';
UPDATE universities SET slug_aliases =
  (SELECT array_agg(DISTINCT x) FROM unnest(array_cat(slug_aliases, '{cjlu}')) x)
  WHERE slug = 'china-jiliang-university';
