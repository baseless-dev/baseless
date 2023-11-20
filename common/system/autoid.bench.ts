import { autoid, isAutoId } from "./autoid.ts";

Deno.bench("autoid", () => {
	autoid();
});

const id = autoid();

Deno.bench("isAutoId", () => {
	isAutoId(id);
});
