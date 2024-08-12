import {
	type TArray,
	type TLiteral,
	type TObject,
	type TRecursive,
	type TString,
	type TThis,
	type TUnion,
	Type,
} from "@sinclair/typebox";

export interface AuthenticationCeremonyComponent {
	kind: "component";
	component: string;
}

export interface AuthenticationCeremonySequence<T = AuthenticationCeremony> {
	kind: "sequence";
	components: T[];
}

export interface AuthenticationCeremonyChoice<T = AuthenticationCeremony> {
	kind: "choice";
	components: T[];
}

export type AuthenticationCeremony =
	| AuthenticationCeremonyComponent
	| AuthenticationCeremonySequence
	| AuthenticationCeremonyChoice;

export type AuthenticationCeremonyChoiceShallow = AuthenticationCeremonyChoice<
	AuthenticationCeremonyComponent
>;

export function sequence(...components: AuthenticationCeremony[]): AuthenticationCeremonySequence {
	return { kind: "sequence", components };
}

export function choice(...components: AuthenticationCeremony[]): AuthenticationCeremonyChoice {
	return { kind: "choice", components };
}

export const AuthenticationCeremonyComponent: TObject<{
	kind: TLiteral<"component">;
	component: TString;
}> = Type.Object({
	kind: Type.Literal("component"),
	component: Type.String(),
}, { $id: "AuthenticationCeremonyComponent" });

export const AuthenticationCeremony: TRecursive<
	TUnion<[
		typeof AuthenticationCeremonyComponent,
		TObject<{
			kind: TLiteral<"sequence">;
			components: TArray<TThis>;
		}>,
		TObject<{
			kind: TLiteral<"choice">;
			components: TArray<TThis>;
		}>,
	]>
> = Type.Recursive((self) =>
	Type.Union([
		AuthenticationCeremonyComponent,
		Type.Object({
			kind: Type.Literal("sequence"),
			components: Type.Array(self),
		}, { $id: "AuthenticationCeremonySequence" }),
		Type.Object({
			kind: Type.Literal("choice"),
			components: Type.Array(self),
		}, { $id: "AuthenticationCeremonyChoice" }),
	], { $id: "AuthenticationCeremony" })
);

export const AuthenticationCeremonySequence = Type.Object({
	kind: Type.Literal("sequence"),
	components: Type.Array(AuthenticationCeremony),
}, { $id: "AuthenticationCeremonySequence" });

export const AuthenticationCeremonyChoice = Type.Object({
	kind: Type.Literal("choice"),
	components: Type.Array(AuthenticationCeremony),
}, { $id: "AuthenticationCeremonyChoice" });

export const AuthenticationCeremonyChoiceShallow = Type.Object({
	kind: Type.Literal("choice"),
	components: Type.Array(AuthenticationCeremonyComponent),
}, { $id: "AuthenticationCeremonyChoiceShallow" });

export function isAuthenticationCeremonyComponent(
	value: unknown,
): value is AuthenticationCeremonyComponent {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "component" && "component" in value && typeof value.component === "string";
}

export function isAuthenticationCeremonySequence(
	value: unknown,
): value is AuthenticationCeremonySequence {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "sequence" && "components" in value && Array.isArray(value.components) &&
		value.components.every(isAuthenticationCeremony);
}

export function isAuthenticationCeremonyChoice(
	value: unknown,
): value is AuthenticationCeremonyChoice {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "choice" && "components" in value && Array.isArray(value.components) &&
		value.components.every(isAuthenticationCeremony);
}

export function isAuthenticationCeremony(value: unknown): value is AuthenticationCeremony {
	return isAuthenticationCeremonyComponent(value) || isAuthenticationCeremonySequence(value) ||
		isAuthenticationCeremonyChoice(value);
}

export function isAuthenticationCeremonyEquals(
	a: AuthenticationCeremony,
	b: AuthenticationCeremony,
): boolean {
	if (a.kind !== b.kind) return false;
	switch (a.kind) {
		case "component":
			return a.component === (b as AuthenticationCeremonyComponent).component;
		case "sequence":
			return a.components.length ===
					(b as AuthenticationCeremonySequence).components.length &&
				a.components.every((v, i) =>
					isAuthenticationCeremonyEquals(
						v,
						(b as AuthenticationCeremonySequence).components[i],
					)
				);
		case "choice":
			return a.components.length === (b as AuthenticationCeremonyChoice).components.length &&
				a.components.every((v, i) =>
					isAuthenticationCeremonyEquals(
						v,
						(b as AuthenticationCeremonyChoice).components[i],
					)
				);
	}
	return false;
}

export function extractAuthenticationCeremonyComponents(
	ceremony: AuthenticationCeremony,
): AuthenticationCeremonyComponent[] {
	function extract(ceremony: AuthenticationCeremony): AuthenticationCeremonyComponent[] {
		switch (ceremony.kind) {
			case "component":
				return [ceremony];
			case "sequence":
				return ceremony.components.flatMap(extractAuthenticationCeremonyComponents);
			case "choice":
				return ceremony.components.flatMap(extractAuthenticationCeremonyComponents);
		}
	}
	// Extract recursively and remove duplicates
	return extract(ceremony)
		.filter((c, i, a) => a.findIndex(isAuthenticationCeremonyEquals.bind(null, c)) === i);
}

export function simplifyAuthenticationCeremony(
	ceremony: AuthenticationCeremony,
): AuthenticationCeremony {
	if (ceremony.kind === "sequence" || ceremony.kind === "choice") {
		const components: AuthenticationCeremony[] = [];
		for (let c of ceremony.components) {
			c = simplifyAuthenticationCeremony(c);
			if (c.kind === ceremony.kind) {
				components.push(...c.components);
			} else {
				components.push(c);
			}
		}
		const uniqueComponents = components.filter((c, i) =>
			components.findIndex(isAuthenticationCeremonyEquals.bind(null, c)) === i
		);
		if (uniqueComponents.length === 1) {
			return uniqueComponents[0];
		}
		return ceremony.kind === "sequence"
			? sequence(...uniqueComponents)
			: choice(...uniqueComponents);
	}
	return ceremony;
}

function isAuthenticationCeremonyShallow(
	ceremony: AuthenticationCeremony,
): boolean {
	if (ceremony.kind === "component") {
		return true;
	}
	return ceremony.components.every(isAuthenticationCeremonyComponent);
}

export function* walkAuthenticationCeremony(
	ceremony: AuthenticationCeremony,
): Generator<
	[
		ceremony: AuthenticationCeremonyComponent,
		parents: AuthenticationCeremonyComponent[],
	] | [
		ceremony: null,
		parents: AuthenticationCeremonyComponent[],
	]
> {
	function* _walk(
		ceremony: AuthenticationCeremony,
		parents: AuthenticationCeremonyComponent[],
	): Generator<
		[
			ceremony: AuthenticationCeremonyComponent,
			parents: AuthenticationCeremonyComponent[],
		]
	> {
		if (ceremony.kind === "sequence") {
			if (isAuthenticationCeremonyShallow(ceremony)) {
				const p = [...parents];
				for (const c of ceremony.components) {
					yield* _walk(c, [...p]);
					p.push(c as AuthenticationCeremonyComponent);
				}
			} else {
				for (let i = 0, l = ceremony.components.length; i < l; ++i) {
					const c = ceremony.components[i];
					if (c.kind === "choice") {
						for (const c2 of c.components) {
							yield* _walk(
								simplifyAuthenticationCeremony(sequence(
									...ceremony.components.slice(0, i),
									c2,
									...ceremony.components.slice(i + 1),
								)),
								parents,
							);
						}
						break;
					}
				}
			}
		} else if (ceremony.kind === "choice") {
			for (const c of ceremony.components) {
				yield* _walk(c, parents);
			}
		} else {
			yield [ceremony, parents];
		}
	}
	// Create temporary ceremony with a special component as marker
	const ceremonyWithDone = simplifyAuthenticationCeremony(
		sequence(ceremony, { kind: "component", component: "$DONE$" }),
	);
	for (const [component, parents] of _walk(ceremonyWithDone, [])) {
		// Skip the special component
		if (component.component === "$DONE$") {
			yield [null, parents];
		} else {
			yield [component, parents];
		}
	}
}

export function getAuthenticationCeremonyComponentAtPath(
	ceremony: AuthenticationCeremony,
	path: string[],
):
	| AuthenticationCeremonyComponent
	| AuthenticationCeremonyChoiceShallow
	| true
	| undefined {
	const components: AuthenticationCeremony[] = [];
	for (const [component, parents] of walkAuthenticationCeremony(ceremony)) {
		// If we've reach the end of the ceremony
		if (component === null) {
			// and the path matches
			if (
				path.length > 0 && path.length === parents.length &&
				path.every((p, i) => parents[i].component === p)
			) {
				return true;
			}
			continue;
		}
		// If the path matches and we've never collected this component before
		if (
			path.length === parents.length &&
			path.every((p, i) => parents[i].component === p) &&
			!components.find(isAuthenticationCeremonyEquals.bind(null, component))
		) {
			components.push(component);
		}
	}
	if (components.length === 1) {
		return components.at(0)! as never;
	} else if (components.length > 1) {
		return choice(...components) as never;
	}
	return;
}
