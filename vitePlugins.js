import * as vite from "vite";
import path from "path";
import fs from "fs";

// Entity shape = { source: "", destination: "", fileName: "" };
// 'source'
//    - must be a file.
// 'destination'
//    - is relative to `build.outDir`
//    - must be a directory
//    - if you provide `./foo.js` it will be treated as a directory
//    - if it doesnt exist we recursively create it (meaning if you specify
// 			"/some/path/to/foo" but only "/some/path" exists, we will create all
// 			folders needed, aka "/some/path/to/foo")
// 'fileName'
//    - the name of the file you want to end up with in your destination
//    - if filenName is not provided we use the source file name.
export function copyStatic(options = { entities: [] }) {
  let outDir;

  return {
    name: "vite-plugin-copy-static",

    configResolved(config) {
      outDir = config.build.outDir;
    },

    async generateBundle() {
      for (const { source, destination, fileName } of options.entities) {
        if (!fs.existsSync(source)) {
          console.error(`[vite-plugin-copy-static] Source does not exist!`, { source });
          return;
        }
        if (!fs.statSync(source).isFile()) {
          console.error(`[vite-plugin-copy-static] Source is not a file!`, { source });
          return;
        }

        const finalDestination = path.resolve(outDir, destination, fileName ? fileName : path.basename(source));
        const destinationDirectory = path.dirname(finalDestination);

        if (!fs.existsSync(destinationDirectory)) {
          fs.mkdirSync(destinationDirectory, { recursive: true });
        }

        fs.copyFileSync(source, finalDestination);
      }
    },
  };
}

/**
 * Instead of using multiple vite.config files, this allows you to build multiple times
 * from a single file.
 * @param {{ configs: vite.InlineConfig[] }} options
 * @returns
 */
export function multiBuild(options = { configs }) {
  return {
    name: "vite-plugin-multi-build",
    apply: "build",
    closeBundle: async () => {
      for (let i = 0; i < options.configs.length; i++) {
        const config = options.configs[i];
        // Override (or set explicitly) this property. Otherwise, we go into an infinite loop.
        config.configFile = false;
        await vite.build(vite.defineConfig(config));
      }
    },
  };
}
