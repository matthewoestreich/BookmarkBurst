import { defineConfig } from "vite";
import fs from "fs";
import path from "path";
import { copyStatic } from "./vitePluginCopyStatic";

const isChrome = process.env.BROWSER === "chrome";
const isFirefox = process.env.BROWSER === "firefox";

export default defineConfig({
	define: {
		"process.env.BROWSER": JSON.stringify(process.env.BROWSER),
	},
	publicDir: false,
	build: {
		emptyOutDir: true,
		outDir: isChrome ? "dist/chrome" : "dist/firefox", // Output directory for the build
		rollupOptions: {
			input: {
				index: path.resolve(__dirname, "index.html"),
			}
		},
	},
	plugins: [
		copyStatic({
			entities: [{
				source: path.resolve(__dirname, isChrome ? "./src/manifest.chrome.json" : "./src/manifest.firefox.json"),
				destination: ".",
				fileName: "manifest.json"
			}, {
				source: path.resolve(__dirname, "./src/background.js"),
				destination: ".",
			}, {
				source: path.resolve(__dirname, "./src/bookmarkBurst.js"),
				destination: ".",
			}, {
				source: path.resolve(__dirname, "./public/js/bootstrap.bundle.min.js"),
				destination: "./js"
			}, {
				source: path.resolve(__dirname, "./public/icons/icon.png"),
				destination: "./icons"
			}]
		})
	]
});
