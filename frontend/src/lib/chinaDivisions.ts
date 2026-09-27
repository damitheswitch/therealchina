// Canonical province-level -> prefecture-level divisions of mainland China.
// Vendored from the adcode dataset (songzuo/china-administrative-divisions);
// English names normalized to common usage, autonomous prefectures shortened
// to their common short names. Municipalities carry themselves as the single
// city. HK/Macau/Taiwan and county-level detail are out of scope — the picker
// has an "other" escape for anything not listed here.

export interface ProvinceDivision {
  name: string
  cities: string[]
}

export const MUNICIPALITIES: readonly string[] = ['Beijing', 'Shanghai', 'Tianjin', 'Chongqing']

export const CHINA_DIVISIONS: ProvinceDivision[] = [
  {
    name: 'Anhui',
    cities: [
      'Hefei',
      'Wuhu',
      'Bengbu',
      'Huainan',
      'Maanshan',
      'Huaibei',
      'Tongling',
      'Anqing',
      'Huangshan',
      'Chuzhou',
      'Fuyang',
      'Suzhou',
      "Lu'an",
      'Bozhou',
      'Chizhou',
      'Xuancheng',
    ],
  },
  { name: 'Beijing', cities: ['Beijing'] },
  { name: 'Chongqing', cities: ['Chongqing'] },
  {
    name: 'Fujian',
    cities: [
      'Fuzhou',
      'Xiamen',
      'Putian',
      'Sanming',
      'Quanzhou',
      'Zhangzhou',
      'Nanping',
      'Longyan',
      'Ningde',
    ],
  },
  {
    name: 'Gansu',
    cities: [
      'Lanzhou',
      'Jiayuguan',
      'Jinchang',
      'Baiyin',
      'Tianshui',
      'Wuwei',
      'Zhangye',
      'Pingliang',
      'Jiuquan',
      'Qingyang',
      'Dingxi',
      'Longnan',
      'Linxia',
      'Gannan',
    ],
  },
  {
    name: 'Guangdong',
    cities: [
      'Guangzhou',
      'Shaoguan',
      'Shenzhen',
      'Zhuhai',
      'Shantou',
      'Foshan',
      'Jiangmen',
      'Zhanjiang',
      'Maoming',
      'Zhaoqing',
      'Huizhou',
      'Meizhou',
      'Shanwei',
      'Heyuan',
      'Yangjiang',
      'Qingyuan',
      'Dongguan',
      'Zhongshan',
      'Chaozhou',
      'Jieyang',
      'Yunfu',
    ],
  },
  {
    name: 'Guangxi',
    cities: [
      'Nanning',
      'Liuzhou',
      'Guilin',
      'Wuzhou',
      'Beihai',
      'Fangchenggang',
      'Qinzhou',
      'Guigang',
      'Yulin',
      'Baise',
      'Hezhou',
      'Hechi',
      'Laibin',
      'Chongzuo',
    ],
  },
  {
    name: 'Guizhou',
    cities: [
      'Guiyang',
      'Liupanshui',
      'Zunyi',
      'Anshun',
      'Bijie',
      'Tongren',
      'Qianxinan',
      'Qiandongnan',
      'Qiannan',
    ],
  },
  {
    name: 'Hainan',
    cities: [
      'Haikou',
      'Sanya',
      'Sansha',
      'Danzhou',
      'Wuzhishan',
      'Qionghai',
      'Wenchang',
      'Wanning',
      'Dongfang',
      'Dingan',
      'Tunchang',
      'Chengmai',
      'Lingao',
      'Baisha',
      'Changjiang',
      'Ledong',
      'Lingshui',
      'Baoting',
      'Qiongzhong',
    ],
  },
  {
    name: 'Hebei',
    cities: [
      'Shijiazhuang',
      'Tangshan',
      'Qinhuangdao',
      'Handan',
      'Xingtai',
      'Baoding',
      'Zhangjiakou',
      'Chengde',
      'Cangzhou',
      'Langfang',
      'Hengshui',
    ],
  },
  {
    name: 'Heilongjiang',
    cities: [
      'Harbin',
      'Qiqihar',
      'Jixi',
      'Hegang',
      'Shuangyashan',
      'Daqing',
      'Yichun',
      'Jiamusi',
      'Qitaihe',
      'Mudanjiang',
      'Heihe',
      'Suihua',
      "Daxing'anling",
    ],
  },
  {
    name: 'Henan',
    cities: [
      'Zhengzhou',
      'Kaifeng',
      'Luoyang',
      'Pingdingshan',
      'Anyang',
      'Hebi',
      'Xinxiang',
      'Jiaozuo',
      'Puyang',
      'Xuchang',
      'Luohe',
      'Sanmenxia',
      'Nanyang',
      'Shangqiu',
      'Xinyang',
      'Zhoukou',
      'Zhumadian',
      'Jiyuan',
    ],
  },
  {
    name: 'Hubei',
    cities: [
      'Wuhan',
      'Huangshi',
      'Shiyan',
      'Yichang',
      'Xiangyang',
      'Ezhou',
      'Jingmen',
      'Xiaogan',
      'Jingzhou',
      'Huanggang',
      'Xianning',
      'Suizhou',
      'Enshi',
      'Xiantao',
      'Qianjiang',
      'Tianmen',
      'Shennongjia',
    ],
  },
  {
    name: 'Hunan',
    cities: [
      'Changsha',
      'Zhuzhou',
      'Xiangtan',
      'Hengyang',
      'Shaoyang',
      'Yueyang',
      'Changde',
      'Zhangjiajie',
      'Yiyang',
      'Chenzhou',
      'Yongzhou',
      'Huaihua',
      'Loudi',
      'Xiangxi',
    ],
  },
  {
    name: 'Inner Mongolia',
    cities: [
      'Hohhot',
      'Baotou',
      'Wuhai',
      'Chifeng',
      'Tongliao',
      'Ordos',
      'Hulunbuir',
      'Bayannur',
      'Ulanqab',
      'Hinggan',
      'Xilingol',
      'Alxa',
    ],
  },
  {
    name: 'Jiangsu',
    cities: [
      'Nanjing',
      'Wuxi',
      'Xuzhou',
      'Changzhou',
      'Suzhou',
      'Nantong',
      'Lianyungang',
      "Huai'an",
      'Yancheng',
      'Yangzhou',
      'Zhenjiang',
      'Taizhou',
      'Suqian',
    ],
  },
  {
    name: 'Jiangxi',
    cities: [
      'Nanchang',
      'Jingdezhen',
      'Pingxiang',
      'Jiujiang',
      'Xinyu',
      'Yingtan',
      'Ganzhou',
      "Ji'an",
      'Yichun',
      'Fuzhou',
      'Shangrao',
    ],
  },
  {
    name: 'Jilin',
    cities: [
      'Changchun',
      'Jilin',
      'Siping',
      'Liaoyuan',
      'Tonghua',
      'Baishan',
      'Songyuan',
      'Baicheng',
      'Yanbian',
    ],
  },
  {
    name: 'Liaoning',
    cities: [
      'Shenyang',
      'Dalian',
      'Anshan',
      'Fushun',
      'Benxi',
      'Dandong',
      'Jinzhou',
      'Yingkou',
      'Fuxin',
      'Liaoyang',
      'Panjin',
      'Tieling',
      'Chaoyang',
      'Huludao',
    ],
  },
  { name: 'Ningxia', cities: ['Yinchuan', 'Shizuishan', 'Wuzhong', 'Guyuan', 'Zhongwei'] },
  {
    name: 'Qinghai',
    cities: ['Xining', 'Haidong', 'Haibei', 'Huangnan', 'Hainan', 'Golog', 'Yushu', 'Haixi'],
  },
  {
    name: 'Shaanxi',
    cities: [
      "Xi'an",
      'Tongchuan',
      'Baoji',
      'Xianyang',
      'Weinan',
      "Yan'an",
      'Hanzhong',
      'Yulin',
      'Ankang',
      'Shangluo',
    ],
  },
  {
    name: 'Shandong',
    cities: [
      'Jinan',
      'Qingdao',
      'Zibo',
      'Zaozhuang',
      'Dongying',
      'Yantai',
      'Weifang',
      'Jining',
      "Tai'an",
      'Weihai',
      'Rizhao',
      'Linyi',
      'Dezhou',
      'Liaocheng',
      'Binzhou',
      'Heze',
    ],
  },
  { name: 'Shanghai', cities: ['Shanghai'] },
  {
    name: 'Shanxi',
    cities: [
      'Taiyuan',
      'Datong',
      'Yangquan',
      'Changzhi',
      'Jincheng',
      'Shuozhou',
      'Jinzhong',
      'Yuncheng',
      'Xinzhou',
      'Linfen',
      'Lvliang',
    ],
  },
  {
    name: 'Sichuan',
    cities: [
      'Chengdu',
      'Zigong',
      'Panzhihua',
      'Luzhou',
      'Deyang',
      'Mianyang',
      'Guangyuan',
      'Suining',
      'Neijiang',
      'Leshan',
      'Nanchong',
      'Meishan',
      'Yibin',
      'Guangan',
      'Dazhou',
      "Ya'an",
      'Bazhong',
      'Ziyang',
      'Ngawa',
      'Garze',
      'Liangshan',
    ],
  },
  { name: 'Tianjin', cities: ['Tianjin'] },
  {
    name: 'Tibet',
    cities: ['Lhasa', 'Shigatse', 'Qamdo', 'Nyingchi', 'Shannan', 'Nagqu', 'Ngari'],
  },
  {
    name: 'Xinjiang',
    cities: [
      'Urumqi',
      'Karamay',
      'Turpan',
      'Hami',
      'Changji',
      'Bortala',
      'Bayingolin',
      'Aksu',
      'Kizilsu',
      'Kashgar',
      'Hotan',
      'Ili',
      'Tacheng',
      'Altay',
      'Shihezi',
      'Alar',
      'Tumxuk',
      'Wujiaqu',
      'Beitun',
      'Tiemenguan',
      'Shuanghe',
      'Kokdala',
      'Kunyu',
      'Huyanghe',
    ],
  },
  {
    name: 'Yunnan',
    cities: [
      'Kunming',
      'Qujing',
      'Yuxi',
      'Baoshan',
      'Zhaotong',
      'Lijiang',
      'Puer',
      'Lincang',
      'Chuxiong',
      'Honghe',
      'Wenshan',
      'Xishuangbanna',
      'Dali',
      'Dehong',
      'Nujiang',
      'Diqing',
    ],
  },
  {
    name: 'Zhejiang',
    cities: [
      'Hangzhou',
      'Ningbo',
      'Wenzhou',
      'Jiaxing',
      'Huzhou',
      'Shaoxing',
      'Jinhua',
      'Quzhou',
      'Zhoushan',
      'Taizhou',
      'Lishui',
    ],
  },
]

export const CHINA_PROVINCES: string[] = CHINA_DIVISIONS.map((p) => p.name)

const cityToProvinces = new Map<string, string[]>()
for (const p of CHINA_DIVISIONS) {
  for (const c of p.cities) {
    const list = cityToProvinces.get(c) ?? []
    list.push(p.name)
    cityToProvinces.set(c, list)
  }
}

/** All provinces containing a prefecture city of this name — 'Suzhou' exists in
 * both Jiangsu (苏州) and Anhui (宿州), genuinely ambiguous. */
export const provincesForCity = (city: string): string[] => cityToProvinces.get(city) ?? []

// Homophone city names with one dominant reading for our audience
// (苏州 Jiangsu >> 宿州 Anhui). Legacy bare-city values resolve through this.
const CITY_PROVINCE_PREFERENCE: Record<string, string> = {
  Suzhou: 'Jiangsu',
  Taizhou: 'Jiangsu',
  Fuzhou: 'Fujian',
  Yichun: 'Jiangxi',
}

/** Best-guess province for a bare city name; undefined when unknown. */
export const inferProvince = (city: string): string | undefined => {
  if (CITY_PROVINCE_PREFERENCE[city]) return CITY_PROVINCE_PREFERENCE[city]
  return provincesForCity(city)[0]
}

/** Canonical storage string for a province/city pick. */
export const formatLocation = (province: string, city: string): string => {
  if (!province) return city.trim()
  if (MUNICIPALITIES.includes(province)) return province
  const c = city.trim()
  return c ? `${c}, ${province}` : province
}

export interface ParsedLocation {
  province: string
  city: string
  /** Raw text when the value isn't a known province/city combination. */
  freeText: string
}

/** Parse a stored location string back into picker state. */
export const parseLocation = (value: string): ParsedLocation => {
  const v = (value ?? '').trim()
  if (!v || v === '__not_listed') return { province: '', city: '', freeText: '' }

  const comma = v.lastIndexOf(',')
  if (comma > 0) {
    const city = v.slice(0, comma).trim()
    const province = v.slice(comma + 1).trim()
    if (CHINA_PROVINCES.includes(province) && city) return { province, city, freeText: '' }
    return { province: '', city: '', freeText: v }
  }

  if (CHINA_PROVINCES.includes(v)) return { province: v, city: '', freeText: '' }

  const prov = inferProvince(v)
  if (prov) return { province: prov, city: v, freeText: '' }

  return { province: '', city: '', freeText: v }
}
