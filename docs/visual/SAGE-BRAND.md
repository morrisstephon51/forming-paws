# Sage — Brand Guide

Sage is Forming Paws' mascot: a friendly, deliberately mixed-breed dog. This
doc governs the character beyond `components/mascot/Sage.tsx` itself --
personality, the two illustrated registers, and the rules that keep new art
consistent with what already ships. See [DESIGN.md](../../DESIGN.md) for the
site-wide palette and type system this all inherits.

## Who Sage is

Warm, a little goofy, unmistakably a mutt. Sage is not a logo mark dressed up
as a dog -- the personality comes first: curious, easy to please, visibly
relieved when things go well (the `celebrating` mood exists because that's a
real beat in the product, not decoration). Sage is a companion walking the
visitor through the site, not a spokesperson selling at them.

## The two registers

**The flat mark** (`components/mascot/Sage.tsx`) is the UI-scale Sage: a
72x72 SVG, six moods, one shared viewBox so swapping mood never shifts the
mark. This is what ships in forms, footers, empty states and the worldflight
corner presence -- anywhere Sage has to read correctly under ~130px.

**The full-body illustration** is the brand/marketing-scale Sage: a
risograph-style line-and-wash character generated at full illustration
detail, used where there's room for it to actually read as a character
rather than an icon. First use: the homepage worldflight peak
(`components/homepage/WorldflightHero.tsx`), where Sage steps into the
meadow full-body as the corner mark fades out -- the small companion
becoming the real dog. Source stills and the background-cutout pipeline live
in `~/.claude/skills/ultimate/scrollcraft/builds/homepage/out/sage/` (not
shipped -- production assets are the exported files below).

**Never generate a new flat mark, and never redraw the full-body art as a
tiny icon.** Each register exists because the other doesn't work at that
size -- the flat mark's whole design point is surviving 30px, and the
full-body art's whole point is carrying real illustration detail. A favicon
or tab-bar instance is always the flat mark, never a shrunk crop of the
full-body art.

## Hard rules (both registers)

1. **One ear up, one ear folded. Always.** This is the platform's
   breed-neutrality made visible -- a symmetrical head reads as a purebred
   silhouette, which is exactly what an anti-puppy-mill platform can't
   endorse. Every generation prompt states this explicitly, and every result
   gets checked for it before use.
2. **The accent color (terracotta, `E8734A`) is a prop, never the coat.** On
   the full-body art that prop is a neckerchief; it could be a leash, a tag,
   a toy in a future pose, but it is never the dog's own fur color. This
   mirrors `DESIGN.md`'s "accent as seal" rule -- it stays meaningful because
   it's rare and deliberate, not a second brand color diluting the first.
3. **No photorealism, no gradients, no shading beyond flat wash + ink line.**
   Both registers are printed-object illustration (a risograph misregistration
   effect on the SVG's own offset `WASH` layer; the same effect literally
   baked into the full-body art's generation prompt). A photoreal or
   airbrushed Sage would be a third, uncoordinated register.

## Generating more full-body art

Reuse this style preamble verbatim -- it's what makes separately generated
poses look like one shoot:

> Risograph-style line-and-wash illustration on warm cream paper stock
> (color FBF7F0), visible paper grain and a subtle print-registration offset
> between line and wash. Loose, confident dark forest-green ink linework
> (color 2F6B5C) for every outline and detail line. Flat, unshaded wash fills
> using only two tones: a muted sage-green (around D2E4DA-E3EFE9) and a warm
> burnt-terracotta-orange (E8734A), each wash plate slightly offset from its
> ink line like a misregistered print. No gradients, no photorealistic
> shading or rendering, no colors beyond ink-green, sage-green wash,
> terracotta wash, and the cream paper ground. Hand-drawn, naturalistic
> linework with a gentle grain texture throughout, generous negative space.

Generate on a plain flat cream background (isolated, no scene, no shadow) so
the result can be cut out -- never generate the character already composited
into a background still, or it can't be reused or repositioned. Pass an
existing pose as `--ref` (seedream image-to-image) to lock the same
individual dog across new poses; both poses currently in production were
locked this way from a single first generation.

Cutting the background out is not a simple color-key: the art's own paper
grain and unbounded fur highlights mean a naive fuzzy-match floods into the
throat/chest fur. The working method (erode the background candidate mask
enough to sever any thin leak channel, keep only the largest connected
component, dilate back to the true edge) is in
`~/.claude/skills/ultimate/scrollcraft/builds/homepage/out/sage/cutout3.py`.
Close-but-wrong parameters clip fine detail (ear tips, tail wisps) instead --
check a magenta-backed preview before shipping a cutout, not just the cutout
alone (transparency is invisible on a matching-color check).

**Budget note:** two full-body stills (2026-09-01, seedream/5-pro) drew ~14
credits each against the real kie.ai ledger -- well under the skill's
conservative 28-credit planning number. Probe balance before and after any
new generation rather than trusting the planning number as actual spend.

## Current poses and where they live

| Pose | File | Use |
|---|---|---|
| Greet (walking, three-quarter, tail mid-wag) | `public/mascot/sage-full-greet.webp` | Homepage worldflight peak (the meadow leg) |
| Sit (upright, three-quarter portrait) | `public/mascot/sage-full-sit.webp` | Reserved -- not yet placed on a page |
| Sit, square-cropped avatar | `public/mascot/sage-avatar-ivory.png`, `public/mascot/sage-avatar-moss.png` | Social profile images, OG-image candidates -- pick the background rung that contrasts with the platform in question |

The sit pose and both avatar crops are unused as of this writing -- built
for the next brand surface (a "Meet Sage" page, social presence, etc.) but
not wired into any page yet. Don't let their existence imply a page exists
that doesn't.
