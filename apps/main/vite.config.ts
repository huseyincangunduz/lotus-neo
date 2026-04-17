import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [tailwindcss()],
  esbuild: {
    jsxImportSource: '@ubs-platform/neolit',
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // Yeni uygulama eklemek için:
        // myApp: resolve(__dirname, 'apps/my-app/index.html'),
      },
    },
  },
})
