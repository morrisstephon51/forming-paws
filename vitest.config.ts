import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // .tsx is included so component tests are actually collected — a .tsx test
    // under a .ts-only glob is skipped silently, which looks exactly like passing.
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
