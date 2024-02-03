export default class RegistrationService {
	// getSignUpCeremony(
	// 	state?: AuthenticationSignUpState,
	// ): AuthenticationCeremonyResponse {
	// 	const lastComponent = state?.components.at(-1);
	// 	if (lastComponent && lastComponent.confirmed === false) {
	// 		const component = this.#components.find((c) => c.id === lastComponent.id);
	// 		if (!component || !component.validationCodePrompt) {
	// 			throw "TODO!";
	// 		}
	// 		return {
	// 			done: false,
	// 			component: { ...component.validationCodePrompt(), id: "validation" },
	// 			first: false,
	// 			last: false,
	// 		};
	// 	}
	// 	const choices = state?.components.map((c) => c.id) ?? [];
	// 	const result = getComponentAtPath(this.#ceremony, choices);
	// 	if (!result || result.kind === "done") {
	// 		return { done: true };
	// 	}
	// 	const last = result.kind === "choice"
	// 		? false
	// 		: getComponentAtPath(this.#ceremony, [
	// 			...choices,
	// 			result.id,
	// 		])?.kind === "done";
	// 	const first = choices.length === 0;
	// 	return {
	// 		done: false,
	// 		component: result,
	// 		first,
	// 		last,
	// 	};
	// }

	// async submitSignUpPrompt(
	// 	id: string,
	// 	value: unknown,
	// 	state?: AuthenticationSignUpState,
	// ): Promise<AuthenticationSignUpResponse> {
	// 	state ??= { kind: "signup" as const, components: [] };
	// 	const signUpCeremony = this.getSignUpCeremony(state);
	// 	if (signUpCeremony.done) {
	// 		throw new AuthenticationCeremonyDoneError();
	// 	}
	// 	const step = signUpCeremony.component.kind === "choice"
	// 		? signUpCeremony.component.components.find((
	// 			s,
	// 		): s is AuthenticationCeremonyComponentPrompt =>
	// 			s.kind === "prompt" && s.id === id
	// 		)
	// 		: signUpCeremony.component;
	// 	if (!step || step.kind === "done") {
	// 		throw new AuthenticationInvalidStepError();
	// 	}
	// 	const validating = id === "validation";
	// 	if (id === "validation") {
	// 		id = state.components.at(-1)!.id;
	// 	}
	// 	const identificator = this.#components.find((comp) => comp.id === id);
	// 	if (!identificator) {
	// 		throw new AuthenticationMissingIdentificatorError();
	// 	}
	// 	if (validating) {
	// 		if (!identificator.validateCode || !state.identity) {
	// 			throw "FIXME!";
	// 		}
	// 		const valid = await identificator.validateCode({
	// 			value,
	// 			identity: {
	// 				id: state.identity,
	// 				component: { id: "validation", confirmed: false, meta: {} },
	// 			},
	// 		});
	// 		throw "TODO!";
	// 	} else {
	// 		const identityComponent = {
	// 			id,
	// 			...await identificator.initializeIdentityComponent({ value }),
	// 		};
	// 		const newState = {
	// 			identity: autoid("tid-"),
	// 			...state,
	// 			components: [
	// 				...state.components,
	// 				identityComponent,
	// 			],
	// 		};
	// 		const encryptedState = await this.encryptAuthenticationState(newState);
	// 		const newResult = this.getSignUpCeremony(newState);
	// 		return {
	// 			state: encryptedState,
	// 			response: newResult,
	// 		};
	// 	}
	// }

	// async sendSignUpValidationCode(
	// 	id: string,
	// 	state: AuthenticationSignUpState,
	// ): Promise<void> {
	// 	const signUpCeremony = this.getSignUpCeremony(state);
	// 	if (signUpCeremony.done) {
	// 		throw new AuthenticationCeremonyDoneError();
	// 	}
	// 	const step = signUpCeremony.component.kind === "choice"
	// 		? signUpCeremony.component.components.find((
	// 			s,
	// 		): s is AuthenticationCeremonyComponentPrompt =>
	// 			s.kind === "prompt" && s.id === id
	// 		)
	// 		: signUpCeremony.component;
	// 	if (!step || step.kind === "done") {
	// 		throw new AuthenticationInvalidStepError();
	// 	}
	// 	throw "TODO!";
	// }
}
