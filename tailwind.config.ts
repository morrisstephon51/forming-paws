import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#2F6B5C', dark: '#245448', soft: '#E3EFE9' },
        accent: { DEFAULT: '#E8734A', dark: '#C95A33', soft: '#FDEEE7' },
        ivory: '#FBF7F0',
        ink: { DEFAULT: '#26221C', soft: '#6C6155' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
