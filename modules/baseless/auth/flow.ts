export interface OAuthConfiguration {
	readonly providerId: string;
	readonly providerLabel: { [locale: string]: string };
	readonly providerIcon: string;
	readonly clientId: string;
	readonly clientSecret: string;
	readonly scope: string[];
	readonly authorizationEndpoint: string;
	readonly tokenEndpoint: string;
	readonly openIdEndpoint: string;
}

export interface OTPConfiguration {
	readonly providerId: string;
	readonly providerLabel: { [locale: string]: string };
}

export interface TOTPConfiguration {
	readonly providerId: string;
	readonly providerLabel: { [locale: string]: string };
}

export interface HOTPConfiguration {
	readonly providerId: string;
	readonly providerLabel: { [locale: string]: string };
}

export type AuthStepNodeDefinition =
	| { readonly type: "anonymous" }
	| { readonly type: "email" }
	| { readonly type: "password" }
	| { readonly type: "otp"; readonly config: OTPConfiguration }
	| { readonly type: "totp"; readonly config: TOTPConfiguration }
	| { readonly type: "hotp"; readonly config: HOTPConfiguration }
	| {
		readonly type: "oauth";
		readonly config: OAuthConfiguration;
	};

export interface AuthStepChainDefinition<T extends AuthStepDefinition = AuthStepDefinition> { readonly type: "chain"; steps: T[] }
export interface AuthStepOneOfDefinition<T extends AuthStepDefinition = AuthStepDefinition> { readonly type: "oneOf"; steps: T[] }

export type AuthStepDefinition =
	| AuthStepNodeDefinition
	| AuthStepChainDefinition
	| AuthStepOneOfDefinition;

export type AuthStepLeafDefinition = AuthStepNodeDefinition | AuthStepChainDefinition<AuthStepNodeDefinition> | AuthStepOneOfDefinition<AuthStepNodeDefinition>;
export type AuthStepDecomposedDefinition = AuthStepNodeDefinition | AuthStepChainDefinition<AuthStepNodeDefinition> | AuthStepOneOfDefinition<AuthStepChainDefinition<AuthStepNodeDefinition>>;

export function isAuthStepDefinition(value?: unknown): value is AuthStepDefinition {
	return !!value && typeof value === "object" && "type" in value && typeof value.type === "string";
}

export function assertAuthStepDefinition(value?: unknown): asserts value is AuthStepDefinition {
	if (!isAuthStepDefinition(value)) {
		throw new TypeError(`Value is not a valid step.`);
	}
}

function isAuthStepLeafDefinition(value?: unknown): value is AuthStepLeafDefinition {
	if (!isAuthStepDefinition(value)) {
		return false;
	}
	if (value.type !== "chain" && value.type !== "oneOf") {
		return true;
	}
	return !value.steps.some(step => step.type === "chain" || step.type === "oneOf");
}

export function assertAuthStepLeafDefinition(value?: unknown): asserts value is AuthStepLeafDefinition {
	if (!isAuthStepLeafDefinition(value)) {
		throw new TypeError(`Value is not a valid leaf step.`);
	}
}

export function isAuthStepDecomposedDefinition(value: unknown): value is AuthStepDecomposedDefinition {
	if (!isAuthStepDefinition(value)) {
		return false;
	}
	if (value.type === "chain" && !isAuthStepLeafDefinition(value)) {
		return false;
	}
	if (value.type === "oneOf" && value.steps.some(step => !isAuthStepLeafDefinition(step))) {
		return false;
	}
	return true;
}

export function assertAuthStepDecomposedDefinition(value: unknown): asserts value is AuthStepDecomposedDefinition {
	if (!isAuthStepDecomposedDefinition(value)) {
		throw new TypeError(`Value is not a decomposed step.`);
	}
}

export function chain(...steps: AuthStepDefinition[]): AuthStepChainDefinition {
	if (steps.length === 0) {
		throw new RangeError(`Expected at least one Step, got 0.`);
	}
	for (const step of steps) {
		assertAuthStepDefinition(step);
	}
	return { type: "chain", steps };
}

export function oneOf(...steps: AuthStepDefinition[]): AuthStepDefinition {
	if (steps.length === 0) {
		throw new RangeError(`Expected at least one Step, got 0.`);
	}
	for (const step of steps) {
		assertAuthStepDefinition(step);
	}
	return { type: "oneOf", steps };
}

const ANONYMOUS = Object.freeze({ type: "anonymous" });
export function anonymous(): AuthStepDefinition {
	return ANONYMOUS;
}

const EMAIL = Object.freeze({ type: "email" });
export function email(): AuthStepDefinition {
	return EMAIL;
}

const PASSWORD = Object.freeze({ type: "password" });
export function password(): AuthStepDefinition {
	return PASSWORD;
}

export function otp(config: OTPConfiguration): AuthStepDefinition {
	return { type: "otp", config };
}

export function totp(config: TOTPConfiguration): AuthStepDefinition {
	return { type: "totp", config };
}

export function hotp(config: HOTPConfiguration): AuthStepDefinition {
	return { type: "hotp", config };
}

export function oauth(config: OAuthConfiguration): AuthStepDefinition {
	return { type: "oauth", config };
}

export function authStepIdent(step: AuthStepDefinition): string {
	if (step.type === "otp" || step.type === "totp" || step.type === "hotp" || step.type === "oauth") {
		return `${step.type}:${step.config.providerId}`
	}
	else if (step.type === "chain" || step.type === "oneOf") {
		return `${step.type}(${step.steps.map(authStepIdent)})`;
	}
	return step.type;
}

export function simplifyAuthStep(step: AuthStepDefinition): AuthStepDefinition {
	if (step.type === "chain") {
		const steps = step.steps.reduce((steps, step) => {
			step = simplifyAuthStep(step);
			if (step.type === "chain") {
				steps.push(...step.steps)
			} else {
				steps.push(step);
			}
			return steps;
		}, [] as AuthStepDefinition[]);
		return chain(...steps);
	}
	else if (step.type === "oneOf") {
		const steps = step.steps.reduce((steps, step) => {
			step = simplifyAuthStep(step);
			if (step.type === "oneOf") {
				steps.push(...step.steps)
			} else {
				steps.push(step);
			}
			return steps;
		}, [] as AuthStepDefinition[]);
		if (steps.length === 1) {
			return steps.at(0)!;
		}
		return oneOf(...steps);
	}
	return step;
}

export enum VisitorResult {
	Break = "break",
	Continue = "continue",
	Skip = "skip",
}

export type Visitor<Context> = {
	enter: (step: AuthStepDefinition, context: Context) => VisitorResult;
	leave?: (step: AuthStepDefinition, context: Context) => void;
}

export function visit<Context = never>(
	step: AuthStepDefinition,
	visitor: Visitor<Context>,
	context: Context
) {
	_visit(simplifyAuthStep(step), visitor);
	return context;
	function _visit(step: AuthStepDefinition, { enter, leave }: Visitor<Context>): VisitorResult {
		const result = enter(step, context);
		if (result === VisitorResult.Continue) {
			if (step.type === "chain" || step.type === "oneOf") {
				for (const inner of step.steps) {
					if (_visit(inner, { enter, leave }) === VisitorResult.Break) {
						break;
					}
				}
			}
		}
		leave?.(step, context);
		return result;
	}
}

export function replaceAuthStep(step: AuthStepDefinition, search: AuthStepDefinition, replace: AuthStepDefinition, deep = true): AuthStepDefinition {
	if (step === search) {
		return replace;
	}
	if (deep && (step.type === "chain" || step.type === "oneOf")) {
		let changed = false;
		const steps = step.steps.map(step => {
			const replaced = replaceAuthStep(step, search, replace, true);
			if (replaced !== step) {
				changed = true;
			}
			return replaced;
		});
		if (changed) {
			return { type: step.type, steps };
		}
	}
	return step;
}

export function decomposeAuthStep(step: AuthStepDefinition): AuthStepDecomposedDefinition {
	const decomposed: AuthStepDecomposedDefinition[] = [];
	const trees: AuthStepDefinition[] = [simplifyAuthStep(step)];

	while (trees.length) {
		const root = trees.shift()!;

		if (isAuthStepLeafDefinition(root)) {
			decomposed.push(root as AuthStepDecomposedDefinition);
		} else {
			const steps: AuthStepDefinition[] = [];
			let forked = false;
			const walk: AuthStepDefinition[] = [root];
			while (walk.length > 0) {
				const node = walk.shift()!;
				if (node.type === "oneOf") {
					trees.push(...node.steps.map(step => replaceAuthStep(root, node, step)));
					forked = true;
				}
				else if (node.type === "chain") {
					walk.unshift(...node.steps);
				}
				else {
					steps.push(node);
				}
			}
			if (!forked) {
				trees.push({ type: root.type, steps } as AuthStepDefinition);
			}
		}
	}

	if (decomposed.length > 1) {
		return oneOf(...decomposed) as AuthStepDecomposedDefinition;
	}
	return decomposed.at(0)!;
}

export interface AuthStepNextValue {
	done: false;
	next: AuthStepDefinition;
}

export interface AuthStepNextDone {
	done: true
}

export type AuthStepNext =
	| AuthStepNextValue
	| AuthStepNextDone

export function nextAuthStep(step: AuthStepDefinition, path: string[]): AuthStepNext {
	assertAuthStepDecomposedDefinition(step);
	if (step.type === "chain") {
		let i = 0;
		const stepLen = step.steps.length;
		const pathLen = path.length;
		for (; i < pathLen; ++i) {
			if (authStepIdent(step.steps.at(i)!) !== path[i]) {
				break;
			}
		}
		if (i === stepLen) {
			return { done: true };
		}
		if (i !== pathLen) {
			throw new Error(`Invalid path for this step definition.`);
		}
		return { done: false, next: step.steps.at(i)! };
	}
	else if (step.type === "oneOf") {
		const nextSteps: AuthStepNext[] = [];
		for (const inner of step.steps) {
			try {
				nextSteps.push(nextAuthStep(inner, path));
			} catch (_err) {
				// skip
			}
		}
		if (nextSteps.some(ns => ns.done)) {
			return { done: true };
		}
		if (nextSteps.length === 1) {
			return nextSteps.at(0)!;
		} else if (nextSteps.length) {
			const steps = nextSteps.filter((ns): ns is AuthStepNextValue => !ns.done).map(ns => ns.next);
			return { done: false, next: simplifyAuthStep(oneOf(...new Set(steps))) }
		}
	}
	else if (path.length === 0) {
		return { done: false, next: step };
	}
	else if (authStepIdent(step) === path.at(0)!) {
		return { done: true }
	}
	throw new Error(`Invalid path for this step definition.`);
}