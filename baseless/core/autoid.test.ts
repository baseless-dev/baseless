import {
	assertEquals,
	assertNotEquals,
} from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { autoid } from "./autoid.ts";

Deno.test("generates autoid of 20 characters", () => {
	assertEquals(autoid().length, 20);
	assertNotEquals(autoid(), autoid());
	assertNotEquals(autoid(), autoid());
	assertNotEquals(autoid(), autoid());
});
