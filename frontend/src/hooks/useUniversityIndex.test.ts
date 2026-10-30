import { describe, expect, it } from 'vitest'
import { searchUniversityIndex, type UniversityIndexEntry } from './useUniversityIndex'

const u = (
  name: string,
  name_zh: string | null,
  city: string | null,
  province: string | null = null
): UniversityIndexEntry => ({ id: name, name, name_zh, slug: name.toLowerCase(), city, province })

const INDEX = [
  u('Peking University', '北京大学', 'Beijing'),
  u('Beijing Normal University', '北京师范大学', 'Beijing'),
  u('Zhejiang University', '浙江大学', 'Hangzhou', 'Zhejiang'),
]

describe('searchUniversityIndex', () => {
  it('returns nothing for an empty query', () => {
    expect(searchUniversityIndex(INDEX, '  ')).toEqual([])
  })

  it('matches English names case-insensitively', () => {
    expect(searchUniversityIndex(INDEX, 'PEKING').map((x) => x.name)).toEqual(['Peking University'])
  })

  it('matches Chinese names and cities', () => {
    expect(searchUniversityIndex(INDEX, '浙江').map((x) => x.name)).toEqual(['Zhejiang University'])
    expect(searchUniversityIndex(INDEX, 'hangzhou')).toHaveLength(1)
  })

  it('requires every word to match and ranks prefix matches first', () => {
    const out = searchUniversityIndex(INDEX, 'beijing').map((x) => x.name)
    expect(out).toEqual(['Beijing Normal University', 'Peking University'])
  })
})
