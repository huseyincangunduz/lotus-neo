
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfigWithPaths } from '../../vite-config-global.js'
export default defineConfig(
  defineConfigWithPaths(__dirname, "index.html", [tailwindcss()])
)