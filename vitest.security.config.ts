import { defineConfig } from 'vitest/config'

/**
 * Security test config — runs security.test files.
 * These tests assert PII is structurally unrecoverable (deny-by-default).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/security.test.{ts,tsx}']
  }
})