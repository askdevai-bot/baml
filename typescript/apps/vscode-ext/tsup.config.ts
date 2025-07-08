import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  target: 'node18',
  format: ['cjs'],
  external: ['vscode'],
  bundle: true,
  // We need to disable clean in CI because we want to keep the dist folder which has the baml-cli in it
  clean: process.env.CI === 'true' ? false : true,
  platform: 'node',
  splitting: false,
  treeshake: true,
});
