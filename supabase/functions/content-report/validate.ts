// Payload parsing for content-report, kept pure so it can be unit-tested
// without Supabase env.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const REASON_MAX = 500

export type ReportTarget = 'review' | 'comment'

export type ReportInput = {
  targetType: ReportTarget
  targetId: string
  reason: string | null
}

export function parseReport(body: unknown): ReportInput | { error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Invalid report' }
  }
  const b = body as Record<string, unknown>
  if (b.targetType !== 'review' && b.targetType !== 'comment') {
    return { error: 'Invalid report target' }
  }
  if (typeof b.targetId !== 'string' || !UUID_RE.test(b.targetId)) {
    return { error: 'Invalid report target' }
  }
  let reason: string | null = null
  if (b.reason !== undefined && b.reason !== null) {
    if (typeof b.reason !== 'string') return { error: 'Invalid reason' }
    const trimmed = b.reason.trim()
    if (trimmed.length > REASON_MAX) {
      return { error: `Keep the reason under ${REASON_MAX} characters.` }
    }
    reason = trimmed || null
  }
  return { targetType: b.targetType, targetId: b.targetId.toLowerCase(), reason }
}
