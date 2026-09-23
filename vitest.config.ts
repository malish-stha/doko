import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    server: { deps: { inline: ['convex-test'] } },
    exclude: ['**/node_modules/**', '**/e2e/**'],
    env: {
      // invites.ts refuses to sign tokens without a secret; tests need one.
      INVITE_SIGNING_SECRET: 'vitest-invite-signing-secret-0123456789abcdef',
    },
  },
})
