
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

import { defineConfigWithPaths } from '../../vite-config-global.js'

export default defineConfig(
  defineConfigWithPaths("apps/admin/src/index.html", "../..", [tailwindcss()])
)