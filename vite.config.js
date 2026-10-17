import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/chip-input.js',
      name: 'ChipInput',
      formats: ['es', 'umd'],
      fileName: 'chip-input'
    },
    rollupOptions: { output: { exports: 'named' } }
  }
});
