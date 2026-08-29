import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'import_universities.csv'
OUT_CSV = ROOT / 'universities_seed_clean.csv'
OUT_SQL = ROOT / 'supabase' / 'seed_universities.sql'

# Preferred short slugs for the app's route style
SLUG_OVERRIDES = {
    'Tsinghua University': 'tsinghua',
    'Peking University': 'peking',
    'Zhejiang University': 'zhejiang',
    'Shanghai Jiao Tong University': 'sjtu',
    'Nanjing University': 'nju',
    'Fudan University': 'fudan',
    'University of Science and Technology of China': 'ustc',
    'Huazhong University of Science and Technology': 'hust',
    'Wuhan University': 'wuhan',
    "Xi'an Jiaotong University": 'xjtu',
    'Harbin Institute of Technology': 'hit',
    'Sun Yat-Sen University': 'sysu',
    'Beijing Normal University': 'bnu',
    'Sichuan University': 'scu',
    'Beihang University': 'buaa',
    'Tongji University': 'tongji',
    'Southeast University': 'seu',
    'Renmin University of China': 'ruc',
    'Beijing Institute of Technology': 'bit',
    'Nankai University': 'nankai',
    'Shandong University': 'shandong',
    'Tianjin University': 'tju',
    'Central South University': 'csu',
    'Jilin University': 'jlu',
    'Northwestern Polytechnical University': 'nwpu',
    'Xiamen University': 'xmu',
    'South China University of Technology': 'scut',
    'Dalian University of Technology': 'dlut',
    'East China Normal University': 'ecnu',
    'China Agricultural University': 'cau',
    'University of Electronic Science and Technology of China': 'uestc',
    'Hunan University': 'hnu',
    'University of Science and Technology Beijing': 'ustb',
    'Chongqing University': 'cqu',
    'Nanjing University of Aeronautics and Astronautics': 'nuaa',
    'Northeastern University': 'neu',
    'Nanjing University of Science and Technology': 'njust',
    'Xidian University': 'xidian',
    'Lanzhou University': 'lzu',
    'Beijing Jiaotong University': 'bjtu',
    'Southern University of Science and Technology': 'sustech',
    'Shenzhen University': 'shenzhen',
    'Shaanxi Normal University': 'snnu',
    'Jiangsu University': 'jiangsu',
    'Zhejiang University of Technology': 'zjut',
    'Beijing Forestry University': 'bjfu',
    'South China Normal University': 'scnu',
    'Shanghai University': 'shu',
    'Harbin Engineering University': 'heu',
    'Southwest Jiaotong University': 'swjtu',
    'Huazhong Agricultural University': 'hzau',
    'East China University of Science and Technology': 'ecust',
    'Central China Normal University': 'ccnu',
    'North China University of Science and Technology': 'ncust',
    'North China Institute of Science and Technology': 'ncist',
    'University of South China': 'usc',
    'North University of China': 'nuc',
    'North China University of Technology': 'ncut',
    'Fujian Agriculture and Forestry University': 'fafu',
    'China West Normal University': 'cwnu',
}

# Better city names when the raw data is a province or a known main campus city
CITY_OVERRIDES = {
    'Tsinghua University': 'Beijing',
    'Peking University': 'Beijing',
    'Zhejiang University': 'Hangzhou',
    'Shanghai Jiao Tong University': 'Shanghai',
    'Nanjing University': 'Nanjing',
    'Fudan University': 'Shanghai',
    'University of Science and Technology of China': 'Hefei',
    'Huazhong University of Science and Technology': 'Wuhan',
    'Wuhan University': 'Wuhan',
    "Xi'an Jiaotong University": "Xi'an",
    'Harbin Institute of Technology': 'Harbin',
    'Sun Yat-Sen University': 'Guangzhou',
    'Beijing Normal University': 'Beijing',
    'Sichuan University': 'Chengdu',
    'Beihang University': 'Beijing',
    'Tongji University': 'Shanghai',
    'Southeast University': 'Nanjing',
    'Renmin University of China': 'Beijing',
    'Beijing Institute of Technology': 'Beijing',
    'Nankai University': 'Tianjin',
    'Shandong University': 'Jinan',
    'Tianjin University': 'Tianjin',
    'Central South University': 'Changsha',
    'Jilin University': 'Changchun',
    'Northwestern Polytechnical University': "Xi'an",
    'Xiamen University': 'Xiamen',
    'South China University of Technology': 'Guangzhou',
    'Dalian University of Technology': 'Dalian',
    'East China Normal University': 'Shanghai',
    'China Agricultural University': 'Beijing',
    'University of Electronic Science and Technology of China': 'Chengdu',
    'Hunan University': 'Changsha',
    'University of Science and Technology Beijing': 'Beijing',
    'Chongqing University': 'Chongqing',
    'Nanjing University of Aeronautics and Astronautics': 'Nanjing',
    'Northeastern University': 'Shenyang',
    'Nanjing University of Science and Technology': 'Nanjing',
    'Xidian University': "Xi'an",
    'Lanzhou University': 'Lanzhou',
    'Beijing Jiaotong University': 'Beijing',
    'Southern University of Science and Technology': 'Shenzhen',
    'Shenzhen University': 'Shenzhen',
    'Shaanxi Normal University': "Xi'an",
    'Jiangsu University': 'Zhenjiang',
    'Zhejiang University of Technology': 'Hangzhou',
    'Beijing Forestry University': 'Beijing',
    'South China Normal University': 'Guangzhou',
    'Shanghai University': 'Shanghai',
    'Harbin Engineering University': 'Harbin',
    'Southwest Jiaotong University': 'Chengdu',
    'Huazhong Agricultural University': 'Wuhan',
    'East China University of Science and Technology': 'Shanghai',
    'Central China Normal University': 'Wuhan',
    'North China University of Science and Technology': 'Tangshan',
    'North China Institute of Science and Technology': 'Langfang',
    'University of South China': 'Hengyang',
    'North University of China': 'Taiyuan',
    'North China University of Technology': 'Tangshan',
    'Fujian Agriculture and Forestry University': 'Fuzhou',
    'China West Normal University': 'Nanchong',
}

GENERIC_WORDS = {
    'university', 'universities', 'college', 'colleges', 'school', 'schools',
    'institute', 'institutes', 'academy', 'academies', 'technology', 'science',
    'normal', 'polytechnic', 'of', 'and', 'the', 'china', 'chinese', 'for',
    'north', 'south', 'east', 'west', 'central', 'international', 'a', 'an',
    'amp', 'at', 'technology', 'agricultural', 'petroleum', 'civil', 'engineering',
    'architectural', 'posts', 'telecommunications', 'information', 'mechanical', 'electronic'
}


def clean_city(raw_value: str) -> str:
    value = (raw_value or '').strip().replace('&amp;', '&')
    value = re.sub(r'\s+', ' ', value)
    return value or 'Unknown'


def slugify(name: str) -> str:
    text = (name or '').strip()
    if not text:
        return 'untitled-university'
    if text in SLUG_OVERRIDES:
        return SLUG_OVERRIDES[text]

    text = text.replace('&amp;', ' and ')
    text = text.replace('&', ' and ')
    text = re.sub(r'[^A-Za-z0-9\s-]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    words = [w.lower() for w in text.split(' ') if w]
    filtered = []
    for w in words:
        if w in GENERIC_WORDS:
            continue
        filtered.append(w)
    if not filtered:
        filtered = [w for w in words if w]
    slug = '-'.join(filtered)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')
    return slug or 'untitled-university'


def normalize_row(row: dict) -> dict:
    name = (row.get('name') or '').strip()
    name_zh = (row.get('name_zh') or row.get('name_cn') or '').strip()
    name_zh = re.sub(r'\s+', '', name_zh)
    raw_city = row.get('city') or row.get('location') or ''
    city = clean_city(raw_city)
    if name in CITY_OVERRIDES:
        city = CITY_OVERRIDES[name]
    logo_url = (row.get('logo_url') or row.get('logo') or '').strip()
    slug = SLUG_OVERRIDES.get(name, slugify(name))

    return {
        'name': name,
        'name_zh': name_zh,
        'city': city,
        'slug': slug,
        'logo_url': logo_url,
        'is_verified': 'false'
    }


with SRC.open('r', encoding='utf-8', newline='') as f:
    rows = list(csv.DictReader(f))

clean_rows = [normalize_row(r) for r in rows]

# Ensure every slug is unique before insertion.
slug_usage = {}
for row in clean_rows:
    base_slug = row['slug']
    if base_slug in slug_usage:
        slug_usage[base_slug] += 1
        row['slug'] = f'{base_slug}-{slug_usage[base_slug]}'
    else:
        slug_usage[base_slug] = 1

with OUT_CSV.open('w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['name', 'name_zh', 'city', 'slug', 'logo_url', 'is_verified'])
    writer.writeheader()
    writer.writerows(clean_rows)

with OUT_SQL.open('w', encoding='utf-8') as f:
    f.write('-- Cleaned university seed\n')
    f.write('INSERT INTO universities (name, name_zh, city, slug, logo_url, is_verified)\nVALUES\n')
    values = []
    for row in clean_rows:
        name = row['name'].replace("'", "''")
        name_zh = row['name_zh'].replace("'", "''")
        city = row['city'].replace("'", "''")
        slug = row['slug'].replace("'", "''")
        logo_url = row['logo_url'].replace("'", "''")
        values.append(f"  ('{name}', '{name_zh}', '{city}', '{slug}', '{logo_url}', false)")
    f.write(',\n'.join(values))
    f.write('\nON CONFLICT (slug) DO NOTHING;\n')

print(f'Processed {len(clean_rows)} universities')
print(f'Output CSV: {OUT_CSV}')
print(f'Output SQL: {OUT_SQL}')
print('Example:')
for row in clean_rows[:5]:
    print(row)
