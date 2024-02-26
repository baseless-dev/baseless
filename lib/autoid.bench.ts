import { autoid, isAutoId, krsautoid, ksautoid } from "./autoid.ts";

Deno.bench(
	"autoid with fixed length",
	{ group: "autoid", baseline: true },
	() => {
		autoid();
	},
);
Deno.bench(
	"ksautoid with fixed length",
	{ group: "autoid" },
	() => {
		ksautoid();
	},
);
Deno.bench(
	"krsautoid with fixed length",
	{ group: "autoid" },
	() => {
		krsautoid();
	},
);

const id = autoid();

Deno.bench("isAutoId", () => {
	isAutoId(id);
});
