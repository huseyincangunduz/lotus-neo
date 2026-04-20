import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { exec } from "child_process";
import fs from "fs";
import libsMap from "./libs-map.js";
// exec(`kdialog --msgbox "__dirname: ${__dirname}"`);

const libsDirList = [];

export const defineConfigWithPaths = (
  appDir /*: string */,
  appIndexPath /*: string */,
  plugins = [tailwindcss()],
) => {
  const rootDir = resolve(appDir, "../..");
  return {
    plugins,
    server: {
      fs: {
        allow: [
          rootDir,
          resolve(rootDir, "apps"),
          resolve(rootDir, "libs"),
          resolve(rootDir, "node_modules"),
        ],
      },
    },
    esbuild: {
      jsxImportSource: "@ubs-platform/neolit",
    },
    optimizeDeps: {
      force: true,
    },
    resolve: {
      alias: {
        // Yeni lib eklemek için: '@libs/my-lib': resolve(rootDir, 'libs/my-lib/src')
        // "@libs/ui": resolve(rootDir, "libs/ui/src"),
        ...Object.fromEntries(
          Object.entries(libsMap).map(([key, value]) => [
            key,
            resolve(rootDir, value),
          ]),
        ),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(appDir, appIndexPath),
          // Yeni uygulama eklemek için:
          // myApp: resolve(appDir, '../other-app/index.html'),
        },
      },
    },
  };
};
