await Deno.permissions.request({ name: "run" });
await Deno.permissions.request({ name: "read", path: "./" });
await Deno.permissions.request({ name: "read", path: "../../modules" });
await Deno.permissions.request({ name: "net", host: "0.0.0.0:8080" });
await Deno.permissions.request({ name: "net", host: "0.0.0.0:8081" });
await Deno.permissions.request({ name: "net", host: "0.0.0.0:8787" });

import { debounce } from "https://deno.land/std@0.121.0/async/debounce.ts";

const _processServPublic = Deno.run({
	cmd: [
		"deno",
		"run",
		"--allow-net",
		"--allow-read",
		"https://deno.land/std/http/file_server.ts",
		"-p",
		"8080",
		"--cors",
		"./public",
	],
});
const _processServModules = Deno.run({
	cmd: [
		"deno",
		"run",
		"--allow-net",
		"--allow-read",
		"https://deno.land/std/http/file_server.ts",
		"-p",
		"8081",
		"--cors",
		"../../../dist",
	],
});

let processServBaseless: Deno.Process | undefined;

const restart = debounce(() => {
	if (processServBaseless) {
		processServBaseless.kill("SIGTERM");
	}
	processServBaseless = Deno.run({
		cmd: [
			"deno",
			"run",
			"--allow-net",
			"--allow-read",
			"--allow-write",
			"--import-map=../../import-map.json",
			"./server.ts",
		],
	});
}, 200);

restart();

const watcher = Deno.watchFs([
	"./app.ts",
	"./server.ts",
	"../../modules",
], { recursive: true });

for await (const event of watcher) {
	if (["create", "modify", "remove"].includes(event.kind)) {
		restart();
	}
}
