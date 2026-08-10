import { FlatCompat } from '@eslint/eslintrc'

// eslint-config-next is still eslintrc-format (it exports `{ extends: [...] }`),
// so it has to be bridged into flat config rather than spread directly.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
      '.claude/**',
      // Legacy static files carried over from the GitHub Pages site. Served
      // verbatim by Vercel, not part of the app source.
      'public/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]

export default config
