import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [tailwindcss()],
  esbuild: {
    jsxImportSource: '@ubs-platform/neolit',
  },
  resolve: {
    alias: {
      // Yeni lib eklemek için: '@libs/my-lib': resolve(__dirname, 'libs/my-lib/src')
      '@libs/ui': resolve(__dirname, '../../libs/ui/src'),
    },
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
