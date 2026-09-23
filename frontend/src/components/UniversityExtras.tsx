import type { ReactNode } from 'react'
import { Icons } from './Icons'
import { MediaGallery } from './MediaGallery'
import type { Tables } from '../types/database.types'
import type { UniversityExtras } from '../lib/universityExtras'

type University = Pick<
  Tables<'universities'>,
  'city' | 'country' | 'uni_type' | 'languages_of_instruction' | 'website'
>

// ---- "University facts" rail card -----------------------------------------
// Static directory fields (country/type/languages/website) blended with
// reviewer-reported facts. Rows render only when their data exists, so sparse
// universities never show empty labels.
export const UniversityFacts = ({
  university,
  extras,
}: {
  university: University
  extras: UniversityExtras
}) => {
  const location = [university.city, university.country].filter(Boolean).join(', ')
  const languages =
    university.languages_of_instruction && university.languages_of_instruction.length > 0
      ? university.languages_of_instruction.join(' · ')
      : extras.reportedLanguages.length > 0
        ? `${extras.reportedLanguages.join(' · ')}*`
        : null

  const rows: { label: string; node: ReactNode }[] = []
  if (location) rows.push({ label: 'Location', node: location })
  if (university.uni_type)
    rows.push({
      label: 'Type',
      node: `${university.uni_type === 'public' ? 'Public' : 'Private'} university`,
    })
  if (languages)
    rows.push({
      label: 'Teaching',
      node: languages,
    })
  if (university.website)
    rows.push({
      label: 'Website',
      node: (
        <a
          href={university.website}
          target="_blank"
          rel="noopener noreferrer"
          className="fact-link"
        >
          {university.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}{' '}
          <span aria-hidden="true">↗</span>
        </a>
      ),
    })
  if (extras.programCount > 0)
    rows.push({
      label: 'Programs reviewed',
      node: `${extras.programCount}`,
    })

  if (rows.length === 0) return null

  return (
    <section className="uni-summary uni-rail-card" aria-labelledby="uni-facts-title">
      <h2 className="uni-summary-title" id="uni-facts-title">
        University facts
      </h2>
      <dl className="fact-list">
        {rows.map((r) => (
          <div key={r.label} className="fact-row">
            <dt>{r.label}</dt>
            <dd>{r.node}</dd>
          </div>
        ))}
      </dl>
      {!university.languages_of_instruction?.length && extras.reportedLanguages.length > 0 && (
        <p className="sum-note">* reported by reviewers</p>
      )}
    </section>
  )
}

// ---- "Programs students reviewed" rail card --------------------------------
export const UniversityPrograms = ({ extras }: { extras: UniversityExtras }) => {
  if (extras.topPrograms.length === 0) return null
  const hidden = extras.programCount - extras.topPrograms.length

  return (
    <section className="uni-summary uni-rail-card" aria-labelledby="uni-programs-title">
      <h2 className="uni-summary-title" id="uni-programs-title">
        Programs students reviewed
      </h2>
      <ul className="prog-list">
        {extras.topPrograms.map((p) => (
          <li key={p.name} className="prog-row">
            <div className="prog-name">{p.name}</div>
            <div className="prog-meta">
              {p.levels.length > 0 && <span>{p.levels.join(' · ')}</span>}
              <span className="prog-count">
                {p.count} review{p.count === 1 ? '' : 's'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="sum-note">+{hidden} more in reviews below</p>}
    </section>
  )
}

// ---- "How students funded it" rail card ------------------------------------
// TRC-specific: funding type (CSC / school / provincial / self) matters more to
// this audience than to Western review sites. Headline is the scholarship share.
export const UniversityFunding = ({ extras }: { extras: UniversityExtras }) => {
  if (extras.fundingAnswered === 0) return null

  return (
    <section className="uni-summary uni-rail-card" aria-labelledby="uni-funding-title">
      <h2 className="uni-summary-title" id="uni-funding-title">
        How reviewers funded it
      </h2>
      {extras.scholarshipPct !== null && (
        <p className="fund-headline">
          <strong>{extras.scholarshipPct}%</strong> on scholarship or grant
        </p>
      )}
      <div className="rec-bar" aria-hidden="true">
        {extras.funding.map((f) => (
          <span
            key={f.type}
            className={`rec-seg fund-seg fund-${f.type}`}
            style={{ flexGrow: f.count }}
          />
        ))}
      </div>
      <ul className="fund-list">
        {extras.funding.map((f) => (
          <li key={f.type} className="fund-row">
            <span className={`fund-dot fund-${f.type}`} aria-hidden="true" />
            <span className="fund-label">
              {f.label}
              {f.fullPct !== null && f.fullPct > 0 && (
                <span className="fund-sub">{f.fullPct}% full coverage</span>
              )}
            </span>
            <span className="fund-pct">{f.pct}%</span>
          </li>
        ))}
      </ul>
      <p className="sum-note">
        Based on {extras.fundingAnswered} reviewer{extras.fundingAnswered === 1 ? '' : 's'} who
        shared funding info
      </p>
    </section>
  )
}

// ---- Photo strip ------------------------------------------------------------
// Every image reviewers attached, as one gallery above the review feed.
// MediaGallery supplies the lightbox; styling tweaks live under .uni-photos.
export const UniversityPhotoStrip = ({ extras }: { extras: UniversityExtras }) => {
  if (extras.photos.length === 0) return null
  return (
    <section className="uni-photos" aria-labelledby="uni-photos-title">
      <h2 className="uni-summary-title" id="uni-photos-title">
        <Icons.Camera /> Student photos
      </h2>
      <MediaGallery media={extras.photos} />
    </section>
  )
}
