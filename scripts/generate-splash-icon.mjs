/**
 * Generates `public/splash-icon.png` — a richer icon used by Android's
 * auto-generated PWA splash. The OS splash architecture is:
 *
 *   [background_color] [centered icon] [app name]
 *
 * The bare fist-bump icon on flat teal looks unfinished compared to the
 * in-app SplashOverlay (which adds a yellow halo, white rounded card,
 * and hero text on a gradient background). The OS can't render gradients
 * or halos around the icon — but we can bake the halo + card into the
 * icon image itself, so the OS splash visually mirrors the in-app one.
 *
 * Output: a 1024x1024 PNG with
 *   - transparent corners (OS background_color fills around it)
 *   - yellow radial halo glow
 *   - white rounded square card
 *   - fist-bump logo inside the card with padding
 *
 * Re-run after changing the source icon or brand layout.
 */

import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const SOURCE_ICON = path.join(PUBLIC_DIR, 'icon.png')
const OUTPUT = path.join(PUBLIC_DIR, 'splash-icon.png')

const SIZE = 1024
// White card occupies the central 60% of the canvas; halo extends past it.
const CARD = Math.round(SIZE * 0.60) // 614px
const CARD_OFFSET = Math.round((SIZE - CARD) / 2) // 205px
const CARD_RADIUS = Math.round(CARD * 0.16) // ~98px, matches Tailwind rounded-3xl proportion
// Icon fills ~93% of the card (matches in-app's p-2.5 inside a 144px card).
const ICON_SIZE = Math.round(CARD * 0.93) // ~571px
const ICON_OFFSET = Math.round((SIZE - ICON_SIZE) / 2)
// Halo extends well past the card.
const HALO_RADIUS = Math.round(SIZE * 0.48) // 491px
const HALO_CX = SIZE / 2
const HALO_CY = SIZE / 2

const svg = `
<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F9F871" stop-opacity="0.55"/>
      <stop offset="50%" stop-color="#F9F871" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#F9F871" stop-opacity="0"/>
    </radialGradient>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
      <feOffset dx="0" dy="6" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <circle cx="${HALO_CX}" cy="${HALO_CY}" r="${HALO_RADIUS}" fill="url(#halo)"/>
  <rect x="${CARD_OFFSET}" y="${CARD_OFFSET}" width="${CARD}" height="${CARD}"
        rx="${CARD_RADIUS}" ry="${CARD_RADIUS}" fill="white" filter="url(#cardShadow)"/>
</svg>
`

const haloAndCard = await sharp(Buffer.from(svg)).png().toBuffer()

const resizedIcon = await sharp(SOURCE_ICON)
  .resize(ICON_SIZE, ICON_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

await sharp(haloAndCard)
  .composite([{ input: resizedIcon, top: ICON_OFFSET, left: ICON_OFFSET }])
  .png()
  .toFile(OUTPUT)

console.log(`Wrote ${OUTPUT}`)
