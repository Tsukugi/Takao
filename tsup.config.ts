import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    takao: 'src/index.ts'
  },
  format: ['cjs', 'esm'], // CommonJS, ES Modules (IIFE not suitable for React/Ink)
  outDir: 'dist',
  clean: true,
  minify: true,
  sourcemap: true,
  dts: true, // Generate declaration files
  splitting: false,
  target: 'es2022',
  platform: 'node',
});