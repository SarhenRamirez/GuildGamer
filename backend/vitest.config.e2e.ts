import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    hookTimeout: 30_000,
    testTimeout: 15_000,
    env: { UPLOAD_DIR: join(tmpdir(), 'guildgamer-test-uploads') },
  },
});
