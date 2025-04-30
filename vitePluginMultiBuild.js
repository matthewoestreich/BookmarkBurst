import * as vite from "vite";

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
        // Avoid recursion - must use a unique string so we can detect each build.
        const envString = `${i}__VITE_PLUGIN_MULTI_BUILD__${i}_${Date.now()}`;
        if (process.env[envString]) {
          return;
        }
        process.env[envString] = true;
        await vite.build(vite.defineConfig(options.configs[i]));
      }
    },
  };
}
