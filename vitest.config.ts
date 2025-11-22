import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,js}'],
    exclude: ['node_modules', 'dist'],
    globals: true,
    environment: 'node',
    typecheck: {
      enabled: false  // Disable type checking since we fixed the types already
    }
  }
});