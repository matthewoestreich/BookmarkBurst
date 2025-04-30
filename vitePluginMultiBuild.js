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
        const config = options.configs[i];
        // Override (or set explicitly) this property. Otherwise, we go into an infinite loop.
        config.configFile = false;
        await vite.build(vite.defineConfig(config));
      }
    },
  };
}
