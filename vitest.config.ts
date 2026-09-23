import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    server: { deps: { inline: ['convex-test'] } },
    exclude: ['**/node_modules/**', '**/e2e/**'],
    // Cold "use node" action imports (briefActions) can exceed the 5s default.
    testTimeout: 20_000,
    env: {
      // invites.ts refuses to sign tokens without a secret; tests need one.
      INVITE_SIGNING_SECRET: 'vitest-invite-signing-secret-0123456789abcdef',
      // LLM calls are canned; no provider key is needed or used.
      LLM_MOCK: '1',
      LLM_ALLOW_PROVIDER_COMPARE: '1',
    },
  },
})
