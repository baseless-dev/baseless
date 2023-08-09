import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import walk, { EOS } from "./walk.ts";

Deno.test("walk", () => {
	const email = {
		kind: "identification" as const,
		id: "email",
		prompt: "email" as const,
	};
	const password = {
		kind: "challenge" as const,
		id: "password",
		prompt: "password" as const,
	};
	const otp = { kind: "challenge" as const, id: "otp", prompt: "otp" as const };
	const github = {
		kind: "identification" as const,
		id: "github",
		prompt: "action" as const,
	};
	const google = {
		kind: "identification" as const,
		id: "google",
		prompt: "action" as const,
	};

	assertEquals(
		[...walk(
			h.sequence(h.oneOf(h.sequence(email, password), google, github), otp),
			/*
			1. h.sequence(h.oneOf(h.sequence(email, password), google, github), otp)
			sequence contain oneOf, fork oneOf component and walk them
				yield* walk(simplify(h.sequence(h.sequence(email, password), otp)))
				yield* walk(h.sequence(google, otp))
				yield* walk(h.sequence(github, otp))
			2. h.sequence(email, password, otp)
			sequence doesn't contain oneOf, foreach sequence's component
				yield* walk(email, [])
				yield* walk(password, [email])
				yield* walk(otp, [email, passsword])
			3. h.sequence(google, otp)
			sequence doesn't contain oneOf, foreach sequence's component
				yield* walk(google, [])
				yield* walk(otp, [google])
			4. h.sequence(github, otp)
			sequence doesn't contain oneOf, foreach sequence's component
				yield* walk(github, [])
				yield* walk(otp, [github])
			*/
		)],
		[
			[email, []],
			[password, [email]],
			[otp, [email, password]],
			[EOS, [email, password, otp]],
			[google, []],
			[otp, [google]],
			[EOS, [google, otp]],
			[github, []],
			[otp, [github]],
			[EOS, [github, otp]],
		],
	);

	assertEquals(
		[...walk(
			h.sequence(email, h.oneOf(password, otp), h.oneOf(google, github)),
			/*
			1. h.sequence(email, h.oneOf(password, otp), h.oneOf(google, github)),
			sequence contain oneOf, fork oneOf component and walk them
				yield* h.sequence(email, password, h.oneOf(google, github))
				yield* h.sequence(email, otp, h.oneOf(google, github))
			2. h.sequence(email, password, h.oneOf(google, github))
			sequence contain oneOf, fork oneOf component and walk them
				yield* walk(h.sequence(email, password, google))
				yield* walk(h.sequence(email, password, github))
			3. h.sequence(email, password, google)
			sequence doesn't contain oneOf, foreach sequence's component
				yield* walk(email, [])
				yield* walk(password, [email])
				yield* walk(google, [email, passsword])
			4. h.sequence(email, password, github)
			sequence doesn't contain oneOf, foreach sequence's component
				yield* walk(email, [])
				yield* walk(password, [email])
				yield* walk(github, [email, passsword])
			5. h.sequence(email, otp, h.oneOf(google, github))
				yield* walk(h.sequence(email, otp, google))
				yield* walk(h.sequence(email, otp, github))
			6. h.sequence(email, otp, google)
			sequence doesn't contain oneOf, foreach sequence's component
				yield* walk(email, [])
				yield* walk(otp, [email])
				yield* walk(google, [email, otp])
			7. h.sequence(email, otp, github)
			sequence doesn't contain oneOf, foreach sequence's component
				yield* walk(email, [])
				yield* walk(otp, [email])
				yield* walk(github, [email, otp])
			*/
		)],
		[
			[email, []],
			[password, [email]],
			[google, [email, password]],
			[EOS, [email, password, google]],

			[email, []],
			[password, [email]],
			[github, [email, password]],
			[EOS, [email, password, github]],

			[email, []],
			[otp, [email]],
			[google, [email, otp]],
			[EOS, [email, otp, google]],

			[email, []],
			[otp, [email]],
			[github, [email, otp]],
			[EOS, [email, otp, github]],
		],
	);

	assertEquals(
		[...walk(h.oneOf(google, github))],
		[
			[google, []],
			[EOS, [google]],
			[github, []],
			[EOS, [github]],
		],
	);
	assertEquals(
		[...walk(h.sequence(email, h.oneOf(password, otp)))],
		[
			[email, []],
			[password, [email]],
			[EOS, [email, password]],
			[email, []],
			[otp, [email]],
			[EOS, [email, otp]],
		],
	);
	assertEquals(
		[...walk(h.sequence(email, password, h.oneOf(google, github), otp))],
		[
			[email, []],
			[password, [email]],
			[google, [email, password]],
			[otp, [email, password, google]],
			[EOS, [email, password, google, otp]],

			[email, []],
			[password, [email]],
			[github, [email, password]],
			[otp, [email, password, github]],
			[EOS, [email, password, github, otp]],
		],
	);
	assertEquals(
		[...walk(h.oneOf(h.sequence(email, password, otp), google, github))],
		[
			[email, []],
			[password, [email]],
			[otp, [email, password]],
			[EOS, [email, password, otp]],

			[google, []],
			[EOS, [google]],

			[github, []],
			[EOS, [github]],
		],
	);
});
