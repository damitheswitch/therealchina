// Constant-time string comparison for shared-secret headers, so response
// timing doesn't leak how much of a guessed secret matched.

export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  // Length differences still return early: the secret's length is not the
  // part worth protecting.
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}
