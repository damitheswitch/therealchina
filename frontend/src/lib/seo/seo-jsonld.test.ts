import { describe, it, expect } from 'vitest'
import {
  stringify,
  websiteSchema,
  orgSchema,
  universitySchema,
  breadcrumbSchema,
  itemListSchema,
  reviewSchema,
  faqSchema,
  articleSchema,
  courseSchema,
  personSchema,
} from './jsonld'
import { PROD_ORIGIN, SITE } from './site'

const parse = (s: string) => JSON.parse(s)

describe('jsonld', () => {
  it('stringify escapes </script> inside strings', () => {
    const s = stringify({ name: 'a</script>b' })
    expect(s).not.toContain('</script>')
    expect(parse(s).name).toBe('a</script>b')
  })

  it('websiteSchema + orgSchema use the prod origin', () => {
    expect(parse(stringify(websiteSchema())).url).toBe(`${PROD_ORIGIN}/`)
    const org = parse(stringify(orgSchema()))
    expect(org['@type']).toBe('Organization')
    expect(org.logo).toMatch(/^https:/)
    expect(org.email).toBe(SITE.contactEmail)
  })

  it('universitySchema emits CollegeOrUniversity with canonical URL', () => {
    const o = parse(
      stringify(
        universitySchema({
          name: 'Tsinghua University',
          slug: 'tsinghua-university',
          city: 'Beijing',
          rating: { value: 4.4, count: 5 },
        })
      )
    )
    expect(o['@type']).toBe('CollegeOrUniversity')
    expect(o.url).toBe(`${PROD_ORIGIN}/university/tsinghua-university`)
    expect(o.aggregateRating.ratingValue).toBe(4.4)
    expect(o.aggregateRating.ratingCount).toBe(5)
  })

  it('universitySchema omits aggregateRating below 2 reviews', () => {
    expect(
      parse(stringify(universitySchema({ name: 'X', slug: 'x', rating: { value: 5, count: 1 } })))
        .aggregateRating
    ).toBeUndefined()
    expect(
      parse(stringify(universitySchema({ name: 'X', slug: 'x' }))).aggregateRating
    ).toBeUndefined()
  })

  it('breadcrumbSchema builds ordered ListItems', () => {
    const o = parse(
      stringify(
        breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Universities', url: '/universities' },
        ])
      )
    )
    expect(o['@type']).toBe('BreadcrumbList')
    expect(o.itemListElement).toHaveLength(2)
    expect(o.itemListElement[1].item).toBe(`${PROD_ORIGIN}/universities`)
  })

  it('itemListSchema wraps urls into ListItem urls', () => {
    const o = parse(
      stringify(
        itemListSchema(
          [
            { name: 'A', url: '/university/a' },
            { name: 'B', url: '/university/b' },
          ],
          'Unis'
        )
      )
    )
    expect(o['@type']).toBe('ItemList')
    expect(o.numberOfItems).toBe(2)
    expect(o.itemListElement[0].url).toBe(`${PROD_ORIGIN}/university/a`)
  })

  it('reviewSchema carries rating + body', () => {
    const o = parse(
      stringify(reviewSchema({ author: 'Anon', rating: 4, text: 'good', date: '2025-01-01' }))
    )
    expect(o['@type']).toBe('Review')
    expect(o.reviewRating.ratingValue).toBe(4)
  })

  it('faqSchema + articleSchema + courseSchema + personSchema produce valid objects', () => {
    expect(parse(stringify(faqSchema([{ q: 'Q', a: 'A' }])))['@type']).toBe('FAQPage')
    expect(
      parse(stringify(articleSchema({ title: 'T', description: 'D', url: '/guide/x' })))['@type']
    ).toBe('Article')
    expect(
      parse(
        stringify(
          courseSchema({ name: 'MBBS', slug: 'medicine', providerName: 'X', providerSlug: 'x' })
        )
      )['@type']
    ).toBe('Course')
    expect(parse(stringify(personSchema({ name: 'P', url: '/authors/p' })))['@type']).toBe('Person')
  })
})
