// await t.step("get sign up ceremony", () => {
// 	const { authService } = init();
// 	assertObjectMatch(
// 		authService.getSignUpCeremony(),
// 		{
// 			done: false,
// 			first: true,
// 			last: false,
// 			component: { id: "email" },
// 		},
// 	);
// });

// await t.step("get sign up ceremony with state", () => {
// 	const { authService } = init();
// 	assertObjectMatch(
// 		authService.getSignUpCeremony({ kind: "signup", components: [] }),
// 		{
// 			done: false,
// 			first: true,
// 			last: false,
// 			component: { id: "email" },
// 		},
// 	);
// 	assertObjectMatch(
// 		authService.getSignUpCeremony({
// 			kind: "signup",
// 			components: [{
// 				id: "email",
// 				confirmed: false,
// 				meta: {},
// 				identification: "john@test.local",
// 			}],
// 		}),
// 		{
// 			done: false,
// 			first: false,
// 			last: false,
// 			component: { id: "validation", kind: "prompt", prompt: "otp" },
// 		},
// 	);
// 	assertObjectMatch(
// 		authService.getSignUpCeremony({
// 			kind: "signup",
// 			components: [{
// 				id: "email",
// 				confirmed: true,
// 				meta: {},
// 				identification: "john@test.local",
// 			}],
// 		}),
// 		{
// 			done: false,
// 			first: false,
// 			last: false,
// 			component: {
// 				kind: "choice",
// 				components: [{ id: "password" }, { id: "otp" }],
// 			},
// 		},
// 	);
// 	assertObjectMatch(
// 		authService.getSignUpCeremony({
// 			kind: "signup",
// 			components: [{
// 				id: "email",
// 				confirmed: true,
// 				meta: {},
// 				identification: "john@test.local",
// 			}, {
// 				id: "otp",
// 				confirmed: false,
// 				meta: {},
// 			}],
// 		}),
// 		{
// 			done: false,
// 			first: false,
// 			last: false,
// 			component: { id: "validation", kind: "prompt", prompt: "otp" },
// 		},
// 	);
// 	assertObjectMatch(
// 		authService.getSignUpCeremony({
// 			kind: "signup",
// 			components: [{
// 				id: "email",
// 				confirmed: true,
// 				meta: {},
// 				identification: "john@test.local",
// 			}, {
// 				id: "otp",
// 				confirmed: true,
// 				meta: {},
// 			}],
// 		}),
// 		{
// 			done: true,
// 		},
// 	);
// });

// await t.step("submit sign iup prompt", async () => {
// 	const { authService, messageProvider } = init();
// 	assertObjectMatch(
// 		await authService.submitSignUpPrompt("email", "john@test.local"),
// 		{
// 			response: {
// 				done: false,
// 				first: false,
// 				last: false,
// 				component: { id: "validation", kind: "prompt", prompt: "otp" },
// 			},
// 		},
// 	);
// 	let state = {
// 		kind: "signup" as const,
// 		components: [{
// 			id: "email",
// 			confirmed: false,
// 			identification: "john@test.local",
// 			meta: {},
// 		}],
// 	};
// 	await authService.sendSignUpValidationCode("validation", state);
// 	assertObjectMatch(
// 		await authService.submitSignUpPrompt("validation", "123123", state),
// 		{
// 			response: {
// 				done: false,
// 				first: false,
// 				last: false,
// 				component: {
// 					kind: "choice",
// 					components: [{ id: "password" }, { id: "otp" }],
// 				},
// 			},
// 		},
// 	);
// });
