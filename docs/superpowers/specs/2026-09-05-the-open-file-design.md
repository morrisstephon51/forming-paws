# The Open File — creative direction and build spec

**Date:** 2026-09-05
**Scope:** public marketing surfaces (`/`, `/about`, `/education`, `/vets`, `/donate`, `/faq`, `/contact`)
**Out of scope:** the member product (`/browse`, `/dogs/[id]`, `/matches`, `/home`, `/settings`) keeps the current `.fp-*` system
**Companion artifact:** https://claude.ai/code/artifact/1a1123e2-93ee-4cb8-a0d6-228b47b51ec6

Written against a seven-prompt creative-direction pipeline: direction → experience architecture →
hero → motion system → implementation sequence → design audit → pre-launch audit. Two of those
prompts were followed against their own letter and are documented as such below (motion, §4;
build-from-scratch, §5).

---

## 1. Direction

### 1.1 Thesis

Every competitor asks to be trusted. Forming Paws shows the file — including what is missing from
it. The site is built as an open records room: ruled, indexed, annotated, timestamped, and visibly
incomplete where it is genuinely incomplete. Warmth comes from photography and writing.
Credibility comes from structure.

Target feeling is **relief**, not delight. Secondary register is **civic** — closer to a public
health department than a marketplace, because the product wants two owners to talk before anything
happens and must not promise a checkout.

### 1.2 The three marks — the signature system

One status vocabulary, interface mono at 11px, site-wide, identical meaning everywhere, never
decorative.

| Mark | Name | Meaning |
|---|---|---|
| filled square, `brand` | `VERIFIED` | A human reviewed a document. **Only ever set by the admin review queue.** Carries a revision date. |
| hollow square, `hairline` stroke | `PENDING` | Uploaded, queued, unreviewed. Owner-visible only. |
| struck square, `ink-soft` | `NOT YET` | The thing does not exist, **and we say so publicly**. |

The third mark is the whole idea. This project already runs a content-honesty rule — `/vets` has no
directory, `/donate` has no button, `/about` states plainly it is not a 501(c)(3). Today those read
as an unfinished site. Given a fixed notation they read as the most credible pages on the domain.

**Rules.** A mark is never decorative and never aspirational. A fact with no mark is prose. A fact
with a mark must be derivable from data the platform actually holds — never hand-written into a
template.

### 1.3 Type — no change, one added rule

Newsreader (400 above 24px, 700 below) and Public Sans stay. Metadata uses the **system mono
stack**, not a webfont — a third family for 11px labels would undo the LCP work, and the family is
what signals classification, not the license.

New rule: **mono is only ever metadata.** Never body, never headline, never flourish. Its presence
means "this is a field with a value." Break that and the marks stop meaning anything.

### 1.4 Colour — no change, one promoted role

Palette unchanged from `tailwind.config.ts`. What changes is that `hairline #E7DFD1` is promoted
from "border colour" to **the ruling of the page** — the most-used visual element on the site.
`brand #2F6B5C` becomes the stamp. `accent #E8734A` stays fill-only.

### 1.5 Material

Two materials, no others: warm paper and ruled ink. No glass, gradient mesh, glow, bevel, or shadow
on any content surface. Depth is the six-rung surface ramp. Rules replace the card as the unit of
grouping in most places. Radius is a hierarchy — full pill for nav and primary CTA only, cards
20px, chips and marks 2px.

Composition is left-aligned and asymmetric: a narrow mono metadata rail, then the reading column.
Centring is reserved for the closing CTA, where the symmetry means "end of file."

### 1.6 Photography

Generated with available tooling until real member photographs exist. Spec is source-agnostic so
stock, generated, and eventual real Chicago photography all satisfy it unchanged.

- **Light** — available only. Window, overcast, late sun through a doorway. No strobe, no seamless.
- **Subject** — visibly mixed-breed. Never a fashionable purebred; the platform is anti-puppy-mill.
- **Pose** — at rest, mid-ordinary-moment. Performing dogs read as advertising.
- **Place** — domestic interiors and recognisable Chicago exteriors.
- **Frame** — plain rectangle, 1px hairline, radius ≤ 4px. **Metadata beneath, never over.**
- **Disqualifies** — portrait-mode bokeh, HDR clarity, warm-teal grade, anyone smiling at camera,
  a taut leash, two dogs performing togetherness.

**Hard rule: a generated dog never occupies a file slot.** Generated imagery lives in atmospheric
and hero positions only. It never carries a name, a verified mark, a record, or a location. A
synthetic dog with a green verified badge is a fabricated record on a site whose pitch is that its
records are real — same failure category as the "expert-reviewed guides" claim already stripped
from the landing page. Slots stay empty or stay real.

### 1.7 Reference lock

| Role | Source | Owns — and nothing else |
|---|---|---|
| **Primary** | Operate (`operate.so`) | Structure: faint grid and fine ruled lines as material; thin inset borders instead of elevation; compact meta labels; green as functional fill, never wallpaper. |
| Borrow | Anthropic (`anthropic.com`) | Two details only: the zero-chrome metadata label (mono label above value, no pill/chip/background) and hard-edged surface alternation with **contained inversion** — the dark band is a card with ground on all four sides. |
| Borrow | Fonts In Use (`fontsinuse.com`) | Specimen-catalogue grid: image, then metadata directly beneath, dense and consistent, minimal framing. |
| **Rejected** | Symbolic.ai | Rotated overlapping paper stacks. Needs drop shadows; reads as skeuomorphic desk-clutter. |

**Refuses:** scroll-cinema; body copy over artwork; emoji section markers; aspirational claims.

---

## 2. Experience architecture

Section order answers one question: what must a stranger believe, in what order, before typing an
email address? Real → the health claim is checkable → matching is safe → here are the steps → here
is what is not built → join.

Putting the roadmap's honest gaps **before** the join form is the load-bearing structural decision.
It costs some conversions and buys the ones it keeps.

| # | Section | Message | Layout | Goal |
|---|---|---|---|---|
| 01 | File header | Sticky nav | Ivory, bottom hairline on scroll only | Orientation |
| 02 | Hero | Every dog here has a file you can read | Split 7:5, copy left on ivory | Scroll or Browse |
| 03 | Ledger strip | Four live counts | One ruled row, mono, tabular. **Server-rendered.** Zero says zero. | Proof of life |
| 04 | What a file contains | The differentiator, concrete | A real dog record at full fidelity, all three marks visible. The actual component, not an illustration. | Understand in one glance |
| 05 | How review works | A person reads the document | Four ruled steps, numbered (it is a real sequence). No icons. | "Verified by whom?" |
| 06 | Meeting safely | Neutral locations, checklist, chat after mutual interest | Two-column, checklist on `wash` | Pre-empt the safety objection |
| 07 | Where we are | Roadmap with gaps marked | **Contained inversion** — one moss band, ground on all four sides. Real marks incl. `NOT YET`. | Trade conversion for credibility |
| 08 | Sign in | Returning members | Quiet inset `wash` panel | Member returns |
| 09 | Join | Founding member offer | The one centred block. One field, one button. | The conversion |
| 10 | Questions | FAQ incl. uncomfortable ones | Ruled disclosure rows, first two open | Last objection |
| 11 | Colophon | Footer + the site's own status block | `501(C)(3) · NOT YET`, `PARTNER VETS · NONE ENROLLED` | Close the file honestly |

Other surfaces: `/about` becomes the site's own record. `/education` guides become catalogue
entries carrying `VET-REVIEWED · NOT YET`. `/vets` is the strongest page here — an empty directory
rendered as one, with ruled column headers and zero rows. `/donate` states the reason as a record,
not an apology.

---

## 3. Hero

Two-panel split at **7:5**, not 50/50 — the asymmetry is what stops it looking like every split
hero. Copy panel left on ivory; one photograph right in a plain hairline frame with a mono caption
beneath. Single vertical hairline seam, becoming horizontal on phones with the photo stacking
**below** the copy. Sized to content, never `100vh`.

```
File 001 · Chicago · Rev 09-26

Every dog here has a file you can read.

Forming Paws is a health-verified dog matching platform for
Chicago owners. A person reviews the vet records before any
match unlocks.

[ Browse dogs ]   See what a file contains
```

**SEO trade, stated.** This h1 carries no search intent, and earlier work deliberately rewrote the
title and h1 to lead with the phrase people type. The subhead therefore carries it —
*health-verified dog matching platform* and *Chicago* both land inside the first 160 characters,
and `SITE_TAGLINE` in `lib/site.ts` stays the source for the title tag. If measured organic traffic
argues otherwise, swap the two. Do not do both.

**Behaviour:** no entrance animation, no custom cursor, no parallax, no pinning. The hero is fully
rendered and readable in the server HTML at first paint. The header hairline fading in at 40px is
the entire above-the-fold motion budget.

---

## 4. Motion system

The source prompt asks for loading sequences, smooth scrolling, text reveals, parallax, pinned
sections, scroll choreography and scene transitions. A decision is supplied for every one. For most
the decision is *none*, with a reason. That is still a motion system — a set of binding decisions
about what moves — and it is more opinionated, not less.

**Why:** the thesis forbids it (a record cannot behave like a promotional film); it has already
failed here once (the scroll-cinema opening was rejected in three days); and it is the single
largest source of the failure modes in §6.

| Item | Decision | Reason |
|---|---|---|
| Loading sequence | None | Server-rendered HTML is the loading sequence |
| Smooth scrolling | Native only | `scroll-behavior:smooth` on anchors, off under reduced motion |
| Text reveals | None | Every `[data-sc-in]` hidden until JS = one script error from blank |
| Image transitions | None | Dimensions reserve space; no fade masking a slow load |
| Parallax / depth | Surface ramp only | Two materials, no simulated space |
| Pinned sections | **Forbidden** | The mechanism that painted over and intercepted clicks below it |
| Hover states | **Yes — the budget** | User-initiated and instantly reversible |
| Cursor interactions | None | Touch devices get nothing from any of it |
| Scroll choreography | None | One exception: header hairline at 40px |
| Scene transitions | None | There are no scenes, only sections separated by rules |
| Counters | Static, server-rendered | The count-up shipped a literal `0` in the HTML |
| Page transitions | None | App Router navigation, unadorned |

**What moves.** Four transitions, all user-initiated, all under 200ms, all reversible.

| Element | Property | Duration | Easing |
|---|---|---|---|
| Card under pointer | `box-shadow` → `shadow-float`, no transform | 140ms | `cubic-bezier(.2,0,.2,1)` |
| Button | `background-color` | 120ms | `ease-out` |
| Link | `text-decoration-color` | 100ms | `linear` |
| Disclosure row | `grid-template-rows` 0fr → 1fr | 180ms | `cubic-bezier(.2,0,.2,1)` |
| Header hairline | `opacity` | 120ms | `linear` |

**Focus** is a 2px `brand` ring at 2px offset, instant, on every interactive element. **Never
`accent`** — at 2.82:1 it is invisible as an indicator.

**Reduced motion** simply removes those five transitions. Nothing here is a continuous function of
scroll, so there is no snapping and no fallback pose to design: the reduced-motion experience and
the default experience are the same page.

---

## 5. Implementation

### 5.1 Not from scratch

The source prompt asks for prompts that build the site from scratch. **That instruction is wrong
for this project and must not be followed.** Forming Paws is live: 26 pages, real auth, RLS, an
admin review queue, 27 migrations, 200 passing tests, real members. The prompt's own later sentence
is the one to honour — inspect existing code, test each stage, preserve working functionality.

The last site-wide restyle touched no page logic because `.fp-card`, `.fp-btn`, `.fp-band` were
**redefined underneath existing call sites**. That vocabulary carries most of the surface area.
Do that again.

### 5.2 Stages

| # | Stage | Done when |
|---|---|---|
| 01 | Branch; run Playwright **first** and record pre-existing failures | Baseline written down |
| 02 | `components/record/Mark.tsx` (three CSS-drawn states, no glyphs) + `RecordLine` | Unit tests cover all three states and the no-value case |
| 03 | Redefine `.fp-card` toward ruled rows; add `.fp-rule`, `.fp-rail`, `.fp-record` | All 26 pages render without breakage |
| 04 | Delete `WorldflightHero` and vendored scrollcraft from `public/`; build the split hero | No `[data-sc-*]` attribute remains |
| 05 | Server-render every figure; remove `CountUp` | Real number present in `curl` output |
| 06 | Rebuild homepage sections 04–11 | Sign-in and waitlist still work end to end |
| 07 | Apply `NOT YET` to `/about`, `/vets`, `/education`, `/donate`, footer | Every public claim carries a mark or is prose |
| 08 | Imagery to the §1.6 spec; AVIF + fallback, explicit dimensions | No layout shift on image load |
| 09 | §7 checklist, on a real phone | Checklist complete |

### 5.3 Repo traps

- **Bottom offsets.** `StickyJoinBar` is `fixed bottom-0` on phones only. Every bottom-anchored
  offset adds `--fp-floor`, set to `0` from `sm:` up. The corner mascot cleared it by 7px.
- **Never run `prettier --write`.** No config; hand-maintained style; one run turned a 107-line
  change into a 402-line diff.
- **Migrations.** Numbering has collided twice — `ls supabase/migrations | tail` before naming.
  `CREATE OR REPLACE FUNCTION` silently drops what a later migration added; diff against live first.
- **Stacked PRs.** `delete_branch_on_merge` is false, so squash-merging a base PR does not retarget
  its child — the child merges into a dead branch. Recover with
  `git rebase --onto origin/main <old-base>` then `gh pr edit <n> --base main`.
- **Embedded selects.** Any query joining through `dogs` for a non-owner viewer must go through
  `dogs_browsable`. This has recurred three times.
- **zsh globbing.** `for f in $FILES` over `app/dogs/[id]/` reads the brackets as a character class
  and silently does nothing. Pipe from `grep -rl` instead.
- **Test baseline.** Kill stale dev servers on :3000 — `reuseExistingServer:true` will test a
  previous session's code.

---

## 6. Audit of what is live

Captured from `theplugai.xyz` on 2026-09-05 at 1200px, three scroll depths. Observed, not inferred.

1. **[Critical] The opening is 42% of the page and says almost nothing.** Total scroll height
   9,834px; at 4,200px the page is still inside the worldflight. Four screenfuls, two sentences,
   nothing checkable. *Fix:* delete it; recover ~4,000px.
2. **[Critical] Body copy sits over illustrated artwork.** Measured contrast passes, which is why
   this is dangerous to audit numerically — the failure is **edge competition** with line-art
   contours at the same weight as the type, not luminance. Scrims cannot fix it. *Fix:* split hero,
   copy on solid ivory.
3. **[Critical] The eyebrow uses a colour the system forbids for text.**
   `HEALTH-VERIFIED. LOCAL. OWNER TO OWNER.` is set in `accent #E8734A` at ~11px over illustration
   — 2.82:1, failing even the 3:1 large-text floor, and it is not large text. *Fix:* `accent.dark`
   on solid ivory, then grep every `text-accent` call site.
4. **[High] No navigation above the fold.** Wordmark, headline, mascot. No nav, sign-in, or CTA. A
   returning member has nothing to click. *Fix:* persistent header from the first pixel.
5. **[High] One script failure from blank, and crawlers read zero.** `[data-sc-in]` elements hidden
   until JS; counters ship a literal `0`, so crawlers and no-JS visitors read "0 founding spots."
   *Fix:* server-render everything at its resting visible state; verify on raw `curl` output.
6. **[Medium] The mascot is small, cornered, and doing no work.** ~90px bottom-right with a question
   mark, clearing the sticky bar by 7px. Reads as a chat widget. *Fix:* move Sage to the footer,
   empty states, and review-queue surfaces. `docs/visual/SAGE-BRAND.md` is the authority.
7. **[Medium] The best section is buried at 75% depth.** The roadmap already does a rough version of
   this whole direction — `NOW` / `STARTED` / `VISION` mono labels on flat shadowless cards with
   honest per-item status. *Fix:* promote and generalise it. The Open File is not a foreign import;
   it is this section's pattern given a vocabulary.
8. **[Medium] Card body copy renders washed out**, consistent with elements caught mid-reveal at
   partial opacity. Resolves at stage 04; verify with computed opacity, not by eye.

---

## 7. Pre-launch

| Sev | Issue | Fix |
|---|---|---|
| S1 | Counters ship `0` to crawlers | Server-render; assert on raw HTML in a test |
| S1 | `accent` as text sitewide | Grep `text-accent`; replace with `accent.dark` or `ink-soft` |
| S1 | Content hidden pending JS | Remove reveal attributes; disable JS and confirm readable |
| S2 | Bottom-anchored elements vs. join bar | Every phone `bottom:` adds `--fp-floor`; audit all |
| S2 | Middleware 500s on missing env vars | Non-null assertions + all-route matcher 500s every path including `public/`. Guard and fail soft. |
| S2 | Focus rings using `accent` | 2px `brand`, 2px offset |
| S3 | Images without dimensions | Explicit `width`/`height`; measure CLS |
| S3 | Every route is dynamic | Accepted trade for layout nav; re-measure LCP once the worldflight is gone |

**Checklist.** Baseline recorded before changes · readable with JS disabled · real counter values in
`curl` · no `text-accent` remains · focus ring on every control, keyboard only · tab order matches
visual order · 375/390/768/1024/1440 · a real phone · nothing clipped by the join bar · no
horizontal body scroll · reduced motion identical to default · contrast measured on rendered pixels
· meaningful `alt` everywhere · CLS measured · LCP element identified · no third webfont ·
`<title>` and h1 checked against `SITE_TAGLINE` · OG image regenerated · sitemap and robots correct
· sign-in works on production · waitlist writes a real row · Playwright matches baseline · no new
page makes an old claim newly false · every public claim carries a mark or is prose · no generated
dog occupies a file slot · Safari, Firefox, Chrome, iOS Safari.
