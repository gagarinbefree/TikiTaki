import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'tikitaki/dom': fileURLToPath(new URL('./src/dom.ts', import.meta.url)),
      tikitaki: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], clearMocks: true, restoreMocks: true },
});
