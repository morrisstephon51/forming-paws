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
| 4 | `brand.moss` | `#CFE2D8` | Deeper bands, transitions *(new rung)* |
| 5 | `brand` | `#2F6B5C` | Inverted sections, primary fills |

`hairline` `#E7DFD1` for all borders and dividers.

**Terracotta is a seal, not a surface.** `accent` `#E8734A` clears 3:1 on ivory —
fine for fills and large display, short of body text. Use `accent.dark` `#C95A33`
when accent-coloured text is genuinely needed. Never tint a large background with it.

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

`.fp-btn` · `.fp-btn-accent` · `.fp-btn-ghost` · `.fp-card` · `.fp-card-float`
· `.fp-band` · `.fp-band-deep` · `.fp-band-invert` · `.fp-badge` · `.fp-link`
· `.fp-input` · `.fp-hairline` · `.fp-figure` · `.fp-shell` · `.fp-section`

## Layout

`.fp-shell` is 1200px, used where content is laid out in columns. Text-heavy pages
(legal, education, about) stay at `max-w-3xl` — widening those would lengthen the
measure and hurt reading, which is the opposite of the goal.

## Fonts

Self-hosted via `next/font`. The previous `@import` in `globals.css` was a
three-hop critical path — our CSS, then Google's CSS, then the files — with first
paint blocked behind hop three. Weight lists are exactly what renders and nothing
more.
