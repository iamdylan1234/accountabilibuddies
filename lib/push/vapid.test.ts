import { urlBase64ToUint8Array } from './vapid'

describe('urlBase64ToUint8Array', () => {
  it('decodes a standard base64-url string', () => {
    // 'hello' = 'aGVsbG8' in base64-url (no padding)
    const result = urlBase64ToUint8Array('aGVsbG8')
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111])
  })

  it('handles base64-url with - and _ replacements', () => {
    // 0xfb 0xff = base64 '+/8=' = base64url '-_8'
    const result = urlBase64ToUint8Array('-_8')
    expect(Array.from(result)).toEqual([0xfb, 0xff])
  })

  it('pads correctly when length is not a multiple of 4', () => {
    // 'ab' = base64 'YWI=' (padded), base64url 'YWI' (unpadded)
    const result = urlBase64ToUint8Array('YWI')
    expect(Array.from(result)).toEqual([97, 98])
  })

  it('returns a Uint8Array of the right length for a typical VAPID public key', () => {
    // Real VAPID public keys are 65 bytes (P-256 uncompressed point)
    // 65 bytes -> base64url length ~88 chars (without padding)
    const dummyVapid = 'B' + 'a'.repeat(86)
    const result = urlBase64ToUint8Array(dummyVapid)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(65)
  })
})
