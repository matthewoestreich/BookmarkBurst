import fs from "fs";
import path from "path";

// Entity shape = { source: "", destination: "", fileName: "" };
// 'source'
//    - must be a file.
// 'destination'
//    - is relative to `build.outDir`
//    - must be a directory
//    - if you provide `./foo.js` it will be treated as a directory
//    - if it doesnt exist we create it
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
					fs.mkdirSync(destinationDirectory);
				}

				fs.copyFileSync(source, finalDestination);
			}
		},
	};
}
