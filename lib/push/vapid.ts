/**
 * Decodes a base64-url-encoded string into a Uint8Array. Required because
 * `pushManager.subscribe({ applicationServerKey })` accepts a Uint8Array, not
 * a string. Web-Push VAPID public keys are conventionally distributed as
 * base64-url-encoded P-256 public points.
 *
 * Why not just atob: atob doesn't understand the URL-safe alphabet (-, _) or
 * missing padding. We normalise to standard base64 first, then atob, then
 * convert the resulting binary string to a Uint8Array.
 */
export function urlBase64ToUint8Array(base64UrlString: string): Uint8Array {
  const padding = '='.repeat((4 - (base64UrlString.length % 4)) % 4)
  const base64 = (base64UrlString + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}
