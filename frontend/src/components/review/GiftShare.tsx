import { useState } from 'react'
import { copyText } from '../../lib/copyText'
import { reviewShareLink, type RewardResult } from '../../lib/reviewReward'

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState<boolean | null>(null)
  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      aria-label={label}
      onClick={async () => setCopied(await copyText(text))}
    >
      {copied === null ? 'Copy' : copied ? 'Copied' : 'Copy failed'}
    </button>
  )
}

// Shown once the gift is earned: the email is the record, WeChat is where the
// owner hands the gift over. Both appear together because Gmail often does not
// open in China without a VPN, which is the thing being given.
export const GiftHandoff = ({ reward }: { reward: RewardResult }) => {
  if (!reward.wechatId || !reward.code) return null
  const emailWorked = reward.state === 'sent'
  return (
    <div className="gift-handoff" role="region" aria-label="Claim your gift">
      <h3 className="success-offer-title">
        <span aria-hidden="true">🎁</span> Your free VPN gift is ready
      </h3>
      <ol className="gift-handoff-steps">
        <li>
          {emailWorked
            ? 'Check your email for the steps. Look in spam too.'
            : 'Our email did not go through. That is fine, WeChat works too.'}
        </li>
        <li>
          <span>Add us on WeChat:</span>
          <span className="gift-handoff-value">
            <strong>{reward.wechatId}</strong>
            <CopyButton text={reward.wechatId} label="Copy WeChat ID" />
          </span>
        </li>
        <li>
          <span>Send us this code:</span>
          <span className="gift-handoff-value">
            <strong>{reward.code}</strong>
            <CopyButton text={reward.code} label="Copy gift code" />
          </span>
        </li>
      </ol>
    </div>
  )
}

// Share card: one link that opens the review flow on the same university.
// Carries the reviewer's gift code when they have one, so the second gift can
// be counted.
export const ShareReview = ({
  universitySlug,
  universityName,
  code,
  giftOn,
}: {
  universitySlug: string | null
  universityName: string
  code?: string
  giftOn: boolean
}) => {
  const [copied, setCopied] = useState<boolean | null>(null)
  const link = reviewShareLink(window.location.origin, universitySlug, code)
  const place = universityName || 'your university'
  const message = `I wrote an honest review of ${place} on The Real China. Add yours, it takes about a minute and stays anonymous:`
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const share = async () => {
    try {
      await navigator.share({ title: 'The Real China', text: message, url: link })
    } catch {
      // Closing the share sheet is not an error worth showing.
    }
  }

  return (
    <div className="success-offer share-review" role="region" aria-label="Share with classmates">
      <h3 className="success-offer-title">Know someone else at {place}?</h3>
      <p className="step-sub" style={{ marginBottom: 'var(--sp-2)' }}>
        Send them the link in your class group. Every review helps the next student choose.
        {giftOn && code
          ? ' When 2 friends post a full review from your link, message us on WeChat with your code for a second gift.'
          : ''}
      </p>
      <div className="success-actions">
        {canShare && (
          <button type="button" className="btn btn-primary" onClick={share}>
            Share link
          </button>
        )}
        <button
          type="button"
          className={canShare ? 'btn btn-outline' : 'btn btn-primary'}
          onClick={async () => setCopied(await copyText(`${message} ${link}`))}
        >
          {copied === null ? 'Copy message and link' : copied ? 'Copied' : 'Copy failed'}
        </button>
      </div>
    </div>
  )
}
