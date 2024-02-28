import { isAutoId, ksuid, rksuid, ruid, suid } from "./autoid.ts";

Deno.bench(
	"ruid",
	{ group: "autoid", baseline: true },
	() => {
		ruid();
	},
);
Deno.bench(
	"suid",
	{ group: "autoid" },
	() => {
		suid("foobar");
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
