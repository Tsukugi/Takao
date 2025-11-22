import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    takao: 'src/index.ts'
  },
  format: ['cjs', 'esm', 'iife'], // CommonJS, ES Modules, and IIFE for browser
  outDir: 'dist',
  clean: true,
  minify: true,
  sourcemap: true,
  dts: true, // Generate declaration files
  splitting: false,
  target: 'es2022',
  platform: 'neutral',
});