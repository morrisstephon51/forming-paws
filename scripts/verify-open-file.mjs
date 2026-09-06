/**
 * Verification sweep for The Open File.
 *
 * Checks the properties the direction actually commits to, on rendered pixels
 * rather than on the source that produced them: no horizontal overflow, no
 * console errors, no failed requests, every mark clearing the 3:1 non-text
 * floor against the surface it really sits on, every focusable control carrying
 * a visible focus indicator, and no text below its WCAG threshold.
 *
 *   node scripts/verify-open-file.mjs [baseURL]
 */
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:3100'
const PAGES = ['/', '/about', '/vets', '/donate', '/education', '/faq', '/contact', '/privacy', '/terms']
const WIDTHS = [375, 390, 768, 1024, 1440]

const CHECKS = () => {
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const parse = (s) => {
    const m = (s || '').match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/)
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null
  }
  const surfaceUnder = (el, fromParent) => {
    let n = fromParent ? el.parentElement : el
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0.5) return c
      n = n.parentElement
    }
    return { r: 255, g: 255, b: 255, a: 1 }
  }
  const ratio = (x, y) => {
    const A = lum(x.r, x.g, x.b), B = lum(y.r, y.g, y.b)
    return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05)
  }

  const de = document.documentElement
  const overflowPx = de.scrollWidth - de.clientWidth
  const overflowing = []
  if (overflowPx > 1) {
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width && (r.right > de.clientWidth + 1 || r.left < -1)) {
        overflowing.push(`${el.tagName}.${(el.className || '').toString().split(' ')[0]}`)
      }
    })
  }

  // Text contrast, leaf nodes only.
  const textFails = []
  document.querySelectorAll('main *, footer *, header *').forEach((el) => {
    if (el.children.length || !el.textContent.trim()) return
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return
    const fg = parse(cs.color); if (!fg) return
    const px = parseFloat(cs.fontSize)
    const large = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700)
    const r = ratio(fg, surfaceUnder(el, false))
    if (r < (large ? 3 : 4.5)) textFails.push({ t: el.textContent.trim().slice(0, 34), px, r: +r.toFixed(2) })
  })

  // Marks against their real surface, 3:1 non-text floor.
  const markFails = []
  document.querySelectorAll('.fp-mark').forEach((el) => {
    const cs = getComputedStyle(el)
    const ink = el.dataset.mark === 'verified' ? parse(cs.backgroundColor) : parse(cs.borderTopColor)
    if (!ink) return
    const r = ratio(ink, surfaceUnder(el, true))
    if (r < 3) markFails.push({ state: el.dataset.mark, r: +r.toFixed(2) })
  })

  // Focus indicators on everything actually focusable at this width.
  const focusFails = []
  const focusables = [...document.querySelectorAll('a[href],button,input,select,textarea,summary')].filter((e) => e.offsetParent !== null)
  for (const el of focusables) {
    el.focus()
    const cs = getComputedStyle(el)
    const w = parseFloat(cs.outlineWidth) || 0
    const has = (cs.outlineStyle !== 'none' && w > 0) || (cs.boxShadow && cs.boxShadow !== 'none')
    if (!has) focusFails.push((el.textContent || el.tagName).trim().slice(0, 26))
    el.blur()
  }

  // Nothing may be parked invisible waiting on an observer.
  const hidden = [...document.querySelectorAll('main *')].filter((el) => {
    const cs = getComputedStyle(el)
    return el.textContent.trim() && (parseFloat(cs.opacity) === 0 || cs.visibility === 'hidden')
  }).length

  return {
    overflowPx, overflowing: overflowing.slice(0, 5),
    textFails, markFails, focusFails,
    marksChecked: document.querySelectorAll('.fp-mark').length,
    focusablesChecked: focusables.length,
    hiddenText: hidden,
  }
}

const browser = await chromium.launch()
let failures = 0
const rows = []

for (const path of PAGES) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await ctx.newPage()
    const consoleErrors = []
    const badRequests = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 90)) })
    page.on('response', (r) => { if (r.status() >= 400) badRequests.push(`${r.status()} ${r.url().slice(-52)}`) })

    const res = await page.goto(BASE + path, { waitUntil: 'networkidle' })
    const r = await page.evaluate(CHECKS)

    const problems = []
    if (res.status() !== 200) problems.push(`HTTP ${res.status()}`)
    if (r.overflowPx > 1) problems.push(`overflow ${r.overflowPx}px [${r.overflowing.join(', ')}]`)
    if (r.textFails.length) problems.push(`text contrast x${r.textFails.length} worst ${Math.min(...r.textFails.map(f => f.r))}`)
    if (r.markFails.length) problems.push(`mark contrast x${r.markFails.length}`)
    if (r.focusFails.length) problems.push(`no focus ring: ${r.focusFails.join(', ')}`)
    if (r.hiddenText) problems.push(`${r.hiddenText} hidden text nodes`)
    if (consoleErrors.length) problems.push(`console: ${consoleErrors.join(' | ')}`)
    if (badRequests.length) problems.push(`requests: ${badRequests.join(' | ')}`)

    if (problems.length) failures++
    rows.push({ path, width, ok: problems.length === 0, marks: r.marksChecked, focusables: r.focusablesChecked, problems })
    await ctx.close()
  }
}
await browser.close()

for (const row of rows) {
  const tag = row.ok ? 'PASS' : 'FAIL'
  console.log(`${tag}  ${row.path.padEnd(12)} ${String(row.width).padStart(5)}px  marks:${String(row.marks).padStart(2)} focusable:${String(row.focusables).padStart(2)}` + (row.ok ? '' : '\n        ' + row.problems.join('\n        ')))
}
console.log(`\n${rows.length - failures}/${rows.length} page+width combinations passed.`)
process.exit(failures ? 1 : 0)
