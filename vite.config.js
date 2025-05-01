import path from "path";
import { defineConfig } from "vite";
import { copyStatic, multiBuild } from "./vitePlugins";

const isChrome = process.env.BROWSER === "chrome";
// const isFirefox = process.env.BROWSER === "firefox";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: isChrome ? "dist/chrome" : "dist/firefox",
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
      },
    },
  },
  plugins: [
    copyStatic({
      entities: [
        {
          source: path.resolve(__dirname, isChrome ? "./manifest.chrome.json" : "./manifest.firefox.json"),
          destination: ".",
          fileName: "manifest.json",
        },
      ],
    }),
    // Use multi-build to build our background scripts.
    // Chrome MV3 forces you to use ES modules, while Firefox does just the opposite.
    // Since Vite doesn't support UMD and IIFE output for code-splitting builds, we have to use this workaround.
    // This is the error I was getting : `Invalid value "iife" for option "output.format" - UMD and IIFE output formats are not supported for code-splitting builds.`
    multiBuild({
      configs: [
        {
          build: {
            outDir: isChrome ? "dist/chrome" : "dist/firefox",
            // Don't clean already built files!
            emptyOutDir: false,
            lib: {
              entry: path.resolve(__dirname, "./src/background.js"),
              name: "Background",
              formats: isChrome ? ["es"] : ["iife"],
              fileName: () => `background.js`,
            },
            rollupOptions: {
              output: {
                inlineDynamicImports: true,
              },
            },
          },
        },
      ],
    }),
  ],
});
