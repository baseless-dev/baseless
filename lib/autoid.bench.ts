import { isAutoId, ksuid, rksuid, ruid } from "./autoid.ts";

Deno.bench(
	"ruid",
	{ group: "autoid", baseline: true },
	() => {
		ruid();
	},
);
Deno.bench(
	"ksuid",
	{ group: "autoid" },
	() => {
		ksuid();
	},
);
Deno.bench(
	"rksuid",
	{ group: "autoid" },
	() => {
		rksuid();
	},
);

const id = ruid();

Deno.bench("isAutoId", () => {
	isAutoId(id);
});
