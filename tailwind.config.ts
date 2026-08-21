import type { Config } from 'tailwindcss'

/**
 * Forming Paws design tokens.
 *
 * Adapted 2026-08-21 from three systems on styles.refero.design chosen for
 * matching this brand's existing warmth rather than for looking fashionable:
 * Ease Health ("botanical greenhouse on cream paper"), Function ("warm
 * apothecary journal") and Steep ("serif analytics on warm paper").
 *
 * The palette and the two typefaces are ours and did not change. What was
 * taken is structure: a surface ramp instead of shadows, a wider radius scale,
 * and a display scale that reads as editorial rather than as a bold web app.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /*
         * The surface ramp, level 0 → 5. All three reference systems build
         * depth by stepping tint rather than stacking shadows, and all three
         * warn that the ramp fails if a rung is missing. Ours was missing two:
         * cards sat on pure white (a cold hole punched in a warm page) and
         * brand-soft jumped straight to full brand with nothing between.
         *
         * 0 ivory → 1 paper → 2 wash → 3 brand.soft → 4 brand.moss → 5 brand
         */
        ivory: '#FBF7F0', // 0 page canvas
        paper: '#FFFCF7', // 1 card surface — warm, never #fff
        wash: '#F2EDE3', // 2 inset surfaces, inputs, table stripes
        hairline: '#E7DFD1', // borders and dividers on warm ground

        brand: {
          DEFAULT: '#2F6B5C', // 5
          dark: '#245448',
          soft: '#E3EFE9', // 3
          /*
           * 4 — the rung that was missing. #CFE2D8 was the first value and it
           * put ink-soft at 4.46:1, which fails AA by four hundredths. Nothing
           * used the rung at the time so nothing was failing yet; the moment it
           * was applied to the closing CTA band it would have been. #D2E4DA
           * clears it at 4.56:1 and keeps the most separation from brand.soft
           * of any value that does.
           */
          moss: '#D2E4DA',
        },
        /*
         * Terracotta is a seal, not a surface. Function's rule: reserve it for
         * CTAs, active states and labels.
         *
         * Measured, not assumed. An earlier version of this comment claimed
         * #E8734A "clears 3:1 on ivory"; it does not — it is 2.82:1 on ivory
         * and 2.94:1 on paper, so it fails even the large-text floor. It is a
         * FILL ONLY. It must never carry text and must never be a focus ring.
         *
         * accent.dark is the escape hatch for accent-coloured text, and it was
         * darkened from #C95A33 to #AD4727 so that it is actually one: #C95A33
         * measured 3.94:1 on ivory and 3.72:1 on accent.soft, both short of
         * 4.5:1, which meant the settings notice already shipping in that
         * colour was failing. #AD4727 clears 4.5:1 on every warm ground here —
         * ivory 5.30, paper 5.53, accent.soft 5.01, wash 4.85 — and still
         * carries ivory text at 5.30:1 when used as a fill.
         */
        accent: { DEFAULT: '#E8734A', dark: '#AD4727', soft: '#FDEEE7' },
        ink: { DEFAULT: '#26221C', soft: '#6C6155' },
      },

      fontFamily: {
        display: ['var(--font-display)', 'Fraunces', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'Nunito', 'system-ui', 'sans-serif'],
      },

      /*
       * The radius scale is redefined rather than extended, so the twenty-odd
       * existing `rounded-lg` call sites soften with the rest of the site
       * instead of staying sharp against it. Reference values converge on
       * 20–24px for cards; ours sits at the lower end because our cards are
       * smaller than theirs.
       */
      borderRadius: {
        lg: '0.875rem', // 14px — inputs, small containers (was 8px)
        xl: '1.25rem', //  20px — cards (was 12px)
        '2xl': '1.75rem', // 28px — bands, sections (was 16px)
        '3xl': '2rem', //   32px — hero panels (was 24px)
      },

      /*
       * One shadow, and it is not for cards. Content cards are flat by rule;
       * this is reserved for something genuinely floating above the page —
       * a lifted card under the cursor, a menu, a dialog.
       */
      boxShadow: {
        float:
          '0 0 0 1px rgba(38, 34, 28, 0.05), 0 18px 30px -12px rgba(38, 34, 28, 0.16)',
        none: 'none',
      },

      maxWidth: { shell: '1200px' },
    },
  },
  plugins: [],
}

export default config
