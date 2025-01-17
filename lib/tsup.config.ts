import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src'],
  format: ['cjs'],
  clean: true,
  sourcemap: false,
  splitting: false,
  shims: true,
  dts: true,
});
