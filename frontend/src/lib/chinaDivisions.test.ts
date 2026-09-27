import { describe, it, expect } from 'vitest'
import {
  CHINA_DIVISIONS,
  CHINA_PROVINCES,
  MUNICIPALITIES,
  provincesForCity,
  inferProvince,
  formatLocation,
  parseLocation,
} from './chinaDivisions'

describe('CHINA_DIVISIONS', () => {
  it('covers the 31 mainland province-level divisions, sorted', () => {
    expect(CHINA_PROVINCES).toHaveLength(31)
    expect(CHINA_PROVINCES).toEqual([...CHINA_PROVINCES].sort())
    for (const m of MUNICIPALITIES) expect(CHINA_PROVINCES).toContain(m)
  })

  it('has every city non-empty and duplicate-free within a province', () => {
    for (const p of CHINA_DIVISIONS) {
      expect(p.cities.length).toBeGreaterThan(0)
      expect(new Set(p.cities).size).toBe(p.cities.length)
      for (const c of p.cities) expect(c.trim().length).toBeGreaterThan(0)
    }
  })

  it('municipalities list themselves as the only city', () => {
    for (const m of MUNICIPALITIES) {
      const d = CHINA_DIVISIONS.find((x) => x.name === m)
      expect(d?.cities).toEqual([m])
    }
  })
})

describe('formatLocation', () => {
  it('formats city, province', () => {
    expect(formatLocation('Jiangsu', 'Suzhou')).toBe('Suzhou, Jiangsu')
  })
  it('collapses municipalities to the bare name', () => {
    expect(formatLocation('Beijing', 'Beijing')).toBe('Beijing')
    expect(formatLocation('Beijing', '')).toBe('Beijing')
  })
  it('falls back to the province alone when city is empty', () => {
    expect(formatLocation('Jiangsu', '')).toBe('Jiangsu')
  })
  it('passes through a bare value with no province', () => {
    expect(formatLocation('', 'Berlin')).toBe('Berlin')
  })
})

describe('parseLocation', () => {
  it('round-trips a formatted location', () => {
    expect(parseLocation('Suzhou, Jiangsu')).toEqual({
      province: 'Jiangsu',
      city: 'Suzhou',
      freeText: '',
    })
  })
  it('parses municipalities', () => {
    expect(parseLocation('Beijing')).toEqual({ province: 'Beijing', city: '', freeText: '' })
  })
  it('parses a bare province', () => {
    expect(parseLocation('Zhejiang')).toEqual({ province: 'Zhejiang', city: '', freeText: '' })
  })
  it('keeps an unknown typed city inside a known province', () => {
    expect(parseLocation('Yiwu, Zhejiang')).toEqual({
      province: 'Zhejiang',
      city: 'Yiwu',
      freeText: '',
    })
  })
  it('treats unknown strings as free text', () => {
    expect(parseLocation('Berlin')).toEqual({ province: '', city: '', freeText: 'Berlin' })
    expect(parseLocation('Berlin, Germany')).toEqual({
      province: '',
      city: '',
      freeText: 'Berlin, Germany',
    })
  })
  it('handles empty and legacy sentinel values', () => {
    for (const v of ['', '  ', '__not_listed']) {
      expect(parseLocation(v)).toEqual({ province: '', city: '', freeText: '' })
    }
  })
})

describe('inferProvince', () => {
  it('resolves unambiguous cities', () => {
    expect(inferProvince('Hangzhou')).toBe('Zhejiang')
  })
  it('prefers the dominant reading for homophone cities', () => {
    expect(inferProvince('Suzhou')).toBe('Jiangsu')
    expect(provincesForCity('Suzhou').sort()).toEqual(['Anhui', 'Jiangsu'])
  })
  it('returns undefined for unknown names', () => {
    expect(inferProvince('Nowhereville')).toBeUndefined()
  })
})
