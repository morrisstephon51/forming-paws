# Forming Paws — Design System

Adapted 2026-08-21 from three systems on [styles.refero.design](https://styles.refero.design),
chosen for already sharing this brand's warmth rather than for looking current:

| Source | Descriptor | Taken from it |
|---|---|---|
| [Ease Health](https://styles.refero.design/style/e9f5e976-53f7-42f5-a882-4e63b3c2f734) | Botanical greenhouse on cream paper | Surface ramp, no-shadow rule, card padding floor |
| [Function](https://styles.refero.design/style/21b71be3-78a0-4681-a5b9-64cc4b40eb67) | Warm apothecary journal | Never-pure-white rule, accent-as-seal discipline, pill buttons |
| [Steep](https://styles.refero.design/style/75fdb89f-ca64-41b3-af36-7a78bd09448e) | Serif analytics on warm paper | Display scale, size-scaled negative tracking, flat cards |

**The palette and both typefaces are unchanged.** Fraunces and Nunito, the green,
the terracotta and the ivory are all exactly what they were. What changed is how
they are used.

The three sources independently agree on four rules this site was breaking. Where
three unrelated teams converge, it is a rule rather than one team's taste:

1. **No box-shadows on content cards.** Depth comes from stepping surface tint.
2. **Serif display is never bold.** 400 above 24px.
3. **Negative letter-spacing scales with size.** A flat value is wrong at both ends.
4. **Card padding is 24px or more.** Ease Health: "no tight padding under 21px."

---

## Surfaces

Depth is a ramp, not a stack of shadows. Ours was missing two rungs: cards sat on
pure white — a cold hole punched in a warm page — and `brand.soft` jumped straight
to full `brand` with nothing between.

| Level | Token | Hex | Use |
|---|---|---|---|
| 0 | `ivory` | `#FBF7F0` | Page canvas |
| 1 | `paper` | `#FFFCF7` | Card surfaces — warm, never `#fff` |
| 2 | `wash` | `#F2EDE3` | Inset surfaces: inputs, stripes |
| 3 | `brand.soft` | `#E3EFE9` | Emphasis bands |
| 4 | `brand.moss` | `#D2E4DA` | Deeper bands — the closing CTA *(new rung)* |
| 5 | `brand` | `#2F6B5C` | Inverted sections, primary fills |

`hairline` `#E7DFD1` for all borders and dividers.

Every rung is chosen so `ink-soft` `#6C6155` still clears 4.5:1 on it — that is
what set `brand.moss`, whose first value missed by four hundredths.

**One pair to avoid:** `accent.dark` on `brand.moss` is 4.28:1 and fails AA. It
does not occur anywhere today and must not be introduced. Every other
text-token / surface-rung combination clears 4.5:1; the worst that ships is
`ink-soft` on `brand.moss` at 4.56:1.

**Terracotta is a seal, not a surface.** `accent` `#E8734A` is **fill only** —
measured at 2.82:1 on ivory and 2.94:1 on paper, it fails even the 3:1 large-text
floor, so it must never carry text and never be a focus ring. Use `accent.dark`
`#AD4727` when accent-coloured text is needed: 5.30:1 on ivory, 5.53:1 on paper,
5.01:1 on `accent.soft`. Never tint a large background with either.

## Type

Fluid across 375→1440 in one `clamp()`, so no width leaves a headline at the wrong
size. The minimum is a plain `rem` and the middle term keeps a `rem` component —
a `vw`-only clamp ignores browser text-resize and fails WCAG 1.4.4.

| Class | Size (375 → 1440) | Weight | Tracking |
|---|---|---|---|
| `.fp-display` | 44 → 76px | 400 | −0.028em |
| `.fp-h1` | 38 → 60px | 400 | −0.022em |
| `.fp-h2` | 30 → 40px | 400 | −0.016em |
| `.fp-h3` | 22 → 26px | 400 | −0.008em |
| `.fp-h4` | 20px | **700** | −0.004em |
| `.fp-h5` | 17px | **700** | −0.002em |
| `.fp-eyebrow` | 11px | 700 | +0.10em, uppercase |
| `.fp-lead` | 17 → 19px | 400 | −0.005em |

**Weight splits at 24px.** Above it the serif runs at 400 — the rule the sources
state most forcefully. Below it 400 goes limp against body copy, so card and list
titles stay 700. The brand keeps its warmth where text is small and its composure
where text is large.

## Shape

Radius scale is *redefined*, not extended, so existing `rounded-lg` call sites
soften with everything else instead of staying sharp against it.

`lg` 14px (inputs) · `xl` 20px (cards) · `2xl` 28px (bands) · `3xl` 32px (hero)
· buttons and badges fully round.

## Elevation

One shadow — `shadow-float` — and it is not for cards. Content cards are flat by
rule. It is reserved for things that genuinely leave the page: a card under the
cursor (`.fp-card-float`), a menu, a dialog.

## Vocabulary

Pages do not restyle themselves. They keep calling `.fp-card` and `.fp-btn`; those
definitions moved underneath them. That is why a site-wide overhaul touched no
page logic.

**In use:** `.fp-btn` · `.fp-btn-ghost` · `.fp-card` · `.fp-band` · `.fp-band-deep`
· `.fp-badge` · `.fp-link` · `.fp-input` · `.fp-shell` · `.fp-depth`

**Defined and available, not yet used:** `.fp-btn-accent` · `.fp-card-float`
· `.fp-band-invert` · `.fp-figure` · `.fp-hairline` · `.fp-section` · `.fp-h3`

Listed honestly rather than implied — a vocabulary that documents primitives as
though they were in use is a vocabulary nobody can trust. Note that
`.fp-btn-accent` is unused *and* puts `text-ivory` on `accent`, which is 2.82:1;
it needs a darker fill before it is used anywhere.

## Layout

`.fp-shell` is 1200px, used where content is laid out in columns. Text-heavy pages
(legal, education, about) stay at `max-w-3xl` — widening those would lengthen the
measure and hurt reading, which is the opposite of the goal.

## Fonts

Self-hosted via `next/font`. The previous `@import` in `globals.css` was a
three-hop critical path — our CSS, then Google's CSS, then the files — with first
paint blocked behind hop three. Weight lists are exactly what renders and nothing
more.

---

## Sage — the mascot

A mascot for an anti-puppy-mill platform has a hard constraint before it has a
style: **it cannot look like a breed.** Sage is deliberately mixed — one ear
perked, one folded — because a recognisable purebred head would be the mascot
quietly endorsing a breed this platform exists to be neutral about. That
asymmetry is also what makes the mark hold up at 30px in the footer sign-off,
the smallest instance that actually ships — a symmetrical dog head at that size
is a circle with two bumps.

Drawn in **Line & Wash**: a single-weight brand-green line over flat `brand.soft`
fills, with an offset `accent.soft` wash behind it — a risograph misregistration,
which is what makes the mark read as printed rather than as clip art.

**API.** One component, one prop:

```tsx
<Sage mood="thinking" size={88} />          // decorative — the default
<Sage mood="happy" size={30} label="Sage" /> // only when the mark alone carries meaning
```

Every mood shares one 72×72 viewBox, including moods that use none of the outer
margin. Swapping mood in place — an empty state becoming a result, a form
becoming a confirmation — must not shift the mark a pixel.

| Mood | Wired into |
|---|---|
| `happy` | Footer sign-off |
| `waving` | Signup, member home welcome |
| `thinking` | Browse empty, matches empty, no-dogs-yet |
| `sleeping` | *(none — see note)* |
| `confused` | 404, route error boundary |
| `celebrating` | Thank-you (waitlist, signup, contact) |

**`sleeping` is currently unwired.** It was on four route `loading.tsx` files
until those were removed: a `loading.tsx` introduces a Suspense boundary, and on
a segment whose auth gate is a server-side `redirect()` that downgrades the
response from `307 → /login` to `200` plus a client-side redirect. Measured on
`/browse` and `/matches`. Restoring the loading states needs the auth gate moved
ahead of the boundary — a segment `layout.tsx` works, at the cost of one extra
`getUser()` per request — so it is a deliberate decision rather than a default.

`SageNote` wraps the mascot with a heading and body for empty, loading and error
states, so a dead end never looks like a broken page and the next one nobody
invents a fourth layout for.

Terracotta appears only in props — the paw, the question mark, the confetti,
the tongue. Never on the dog itself, which keeps the accent-as-seal rule intact.
