import { autoid, isAutoId, vautoid } from "./autoid.ts";

Deno.bench(
	"autoid with fixed length",
	{ group: "autoid", baseline: true },
	() => {
		autoid();
	},
);
Deno.bench(
	"autoid with variable length",
	{ group: "autoid" },
	() => {
		vautoid();
	},
);

const id = autoid();

Deno.bench("isAutoId", () => {
	isAutoId(id);
});
