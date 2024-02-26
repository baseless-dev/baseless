import {
	autoid,
	isAutoId,
	krsautoid,
	krsvautoid,
	ksautoid,
	ksvautoid,
	vautoid,
} from "./autoid.ts";

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
Deno.bench(
	"autoid with variable length",
	{ group: "autoid" },
	() => {
		vautoid();
	},
);
Deno.bench(
	"ksautoid with variable length",
	{ group: "autoid" },
	() => {
		ksvautoid();
	},
);
Deno.bench(
	"krsautoid with variable length",
	{ group: "autoid" },
	() => {
		krsvautoid();
	},
);

const id = autoid();

Deno.bench("isAutoId", () => {
	isAutoId(id);
});
