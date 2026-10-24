// "Not listed" university handling for review-submit: payload parsing and the
// choice between matching by slug or by name. Pure (no Supabase client) so it
// is unit-tested in newUniversity_test.ts.

import { LIMITS, asTrimmedString } from '../_shared/reviewFields.ts'
import { GENERIC_UNIVERSITY_WORDS, isWeakSlug, slugify } from '../_shared/slug.ts'

export const UNI_SLUG_MAX = 120

export type NewUniversity = { name: string; city: string; province: string | null }

// Error messages surface to the client as a 400 (review-submit's catch).
export const NEW_UNIVERSITY_REQUIRED = 'University name and city are required'

// undefined when the submission names no new university. Throws on a present
// but invalid payload: missing name/city, wrong field types, or over-long
// fields. Province is optional: the wizard sends it when the visitor picked
// one, and it lets the resolver match a university with no recorded city.
export function parseNewUniversity(raw: unknown): NewUniversity | undefined {
  if (raw === null || raw === undefined || raw === false) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error(NEW_UNIVERSITY_REQUIRED)
  const r = raw as Record<string, unknown>
  const name = asTrimmedString(r.name, LIMITS.uniName.max)
  const city = asTrimmedString(r.city, LIMITS.uniCity.max)
  if (!name || !city) throw new Error(NEW_UNIVERSITY_REQUIRED)
  const province = asTrimmedString(r.province, LIMITS.uniCity.max)
  return { name, city, province }
}

// How to resolve a new university: a slug that identifies the name is matched
// by slug or alias; a weak one (non-Latin or generic-only) can't identify
// anything, so the database resolver matches by name, city and province.
export type NewUniversityPlan = { kind: 'by-slug' | 'by-name'; base: string }

export function planNewUniversity(name: string): NewUniversityPlan {
  const base = slugify(name, UNI_SLUG_MAX)
  return { kind: isWeakSlug(base, GENERIC_UNIVERSITY_WORDS) ? 'by-name' : 'by-slug', base }
}
