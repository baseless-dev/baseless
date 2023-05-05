import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

await emptyDir("./npm");

await build({
	entryPoints: [
		"./index.ts",
		"./app.ts",
		"./auth.ts",
	],
	outDir: "./npm",
	typeCheck: false,
	declaration: true,
	test: false,
	scriptModule: "cjs",
	skipSourceOutput: true,
	shims: {
		deno: false,
	},
	package: {
		name: "baseless",
		version: "0.0.0",
		description: "Your package.",
		license: "MIT",
		repository: {
			type: "git",
			url: "git+https://github.com/username/repo.git",
		},
		bugs: {
			url: "https://github.com/username/repo/issues",
		},
	},
	postBuild() {
		// Deno.copyFileSync("LICENSE", "npm/LICENSE");
		// Deno.copyFileSync("README.md", "npm/README.md");
	},
});
