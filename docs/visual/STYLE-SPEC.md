# Forming Paws illustration style spec

Every generated image on the site was produced against the block below, verbatim,
so the set reads as one commission rather than five separate ones. Reuse it
unchanged when adding art; change it only deliberately, and regenerate the whole
set if you do.

```
Flat editorial vector illustration with fine paper-grain texture. Strictly
limited palette, no other colors: a deep muted forest green, a darker pine
green, a very pale desaturated sage, a warm muted terracotta orange, a soft pale
peach, a cream ivory, and a warm near-black charcoal. Greens must be muted and
desaturated, never bright or spring-like. Soft diffuse late-afternoon light from
the upper left. No harsh shadows. No photographic depth of field or lens blur.
All forms built from flat blocks of color with no outlines and no gradients
steeper than two adjacent palette values. Generous negative space. Mood: warm,
calm, reassuring, trustworthy.

STRICT EXCLUSIONS: absolutely no text, no letters, no numbers, no logos, no
watermarks, no signatures. Do NOT include a color palette strip, color swatches,
a row of color chips, a legend, a border, or a frame. The artwork must be a
single continuous scene filling the whole canvas edge to edge. No people. No
dogs or animals of any kind.
```

## Two rules that are not style preferences

**Never generate a specific dog.** Listing cards, profile photos, and match
results show real uploaded photos or a neutral placeholder. Generated imagery is
atmosphere only — backdrops, section dividers, guide headers, empty-state art. A
plausible-looking dog that does not exist, on a page about verifying real dogs,
is a credibility problem before it is a design one.

**Name the palette in words, not hex.** The first pass listed hex codes and the
model painted them into the canvas as a swatch strip along the bottom edge —
twice, including on a prompt that explicitly forbade it. Describing the colours
in words produces the same palette without the artefact.

## Practical notes

- Prompt at `21:9`, `2K`. Downscale to the widest size the layout can request at
  2x — 2560px for the hero, 1600px for banners — before committing. The 2.2MB
  originals make the repo heavy without making the page sharper.
- Sources live in `assets/art/`, not `public/`. Static imports are what give
  `next/image` intrinsic dimensions and an automatic blur placeholder; files in
  `public/` get neither.
- Flat illustration compresses extraordinarily well: the six committed sources
  total 380KB, and AVIF variants served at real layout widths land between 1KB
  and 11KB per page.
