import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { exec } from "child_process";

// exec(`kdialog --msgbox "__dirname: ${__dirname}"`);

export const defineConfigWithPaths = (
  appIndexPath /*: string */,
  relationAppDirWithRoot /*: string */,
  plugins = [tailwindcss()]
) => {
  return {
    plugins,
    esbuild: {
      jsxImportSource: "@ubs-platform/neolit",
    },
    resolve: {
      alias: {
        // Yeni lib eklemek için: '@libs/my-lib': resolve(__dirname, 'libs/my-lib/src')
        "@libs/ui": resolve(__dirname, "libs/ui/src"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, appIndexPath),
          // Yeni uygulama eklemek için:
          // myApp: resolve(__dirname, 'apps/my-app/index.html'),
        },
      },
    },
  };
};
