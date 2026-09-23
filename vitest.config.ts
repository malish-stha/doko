import { defineConfig } from 'vitest/config'

const sharedEnv = {
  // invites.ts refuses to sign tokens without a secret; tests need one.
  INVITE_SIGNING_SECRET: 'vitest-invite-signing-secret-0123456789abcdef',
  // LLM calls are canned; no provider key is needed or used.
  LLM_MOCK: '1',
  LLM_ALLOW_PROVIDER_COMPARE: '1',
}

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**'],
    // Cold "use node" action imports (briefActions) can exceed the 5s default.
    testTimeout: 20_000,
    projects: [
      {
        // Convex functions run in a V8 isolate; edge-runtime is the closest match.
        test: {
          name: 'convex',
          include: ['convex/**/*.test.ts'],
          environment: 'edge-runtime',
          server: { deps: { inline: ['convex-test'] } },
          testTimeout: 20_000,
          env: sharedEnv,
        },
      },
      {
        // Plain libraries (LLM adapters, parsers, time helpers) run under Node.
        test: {
          name: 'lib',
          include: ['lib/**/*.test.ts'],
          environment: 'node',
          testTimeout: 20_000,
          env: sharedEnv,
        },
      },
    ],
  },
})
