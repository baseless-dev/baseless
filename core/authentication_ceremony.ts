import * as z from "./schema.ts";

/**
 * A single component node in an {@link AuthenticationCeremony} tree.
 * Identifies a named authentication component (e.g. `"email"`, `"password"`).
 */
export interface AuthenticationCeremonyComponent {
	kind: "component";
	component: string;
}

/**
 * An ordered sequence of {@link AuthenticationCeremony} nodes.
 * All components in the sequence must be completed in order.
 */
export interface AuthenticationCeremonySequence<T = AuthenticationCeremony> {
	kind: "sequence";
	components: T[];
}

/**
 * A choice between multiple {@link AuthenticationCeremony} nodes.
 * The user must complete exactly one of the alternatives.
 */
export interface AuthenticationCeremonyChoice<T = AuthenticationCeremony> {
	kind: "choice";
	components: T[];
}

/**
 * A ceremony tree node — either a {@link AuthenticationCeremonyComponent},
 * a {@link AuthenticationCeremonySequence}, or a {@link AuthenticationCeremonyChoice}.
 */
export type AuthenticationCeremony =
	| AuthenticationCeremonyComponent
	| AuthenticationCeremonySequence
	| AuthenticationCeremonyChoice;

/**
 * A shallow {@link AuthenticationCeremonySequence} whose children are all
 * {@link AuthenticationCeremonyComponent} leaves (no nested sequences or choices).
 */
export type AuthenticationCeremonySequenceShallow = AuthenticationCeremonySequence<
	AuthenticationCeremonyComponent
>;

/**
 * A shallow {@link AuthenticationCeremonyChoice} whose alternatives are all
 * {@link AuthenticationCeremonyComponent} leaves (no nested sequences or choices).
 */
export type AuthenticationCeremonyChoiceShallow = AuthenticationCeremonyChoice<
	AuthenticationCeremonyComponent
>;

/**
 * Create a {@link AuthenticationCeremonySequence} of components.
 * @param components Array of {@link AuthenticationCeremony}
 * @returns The {@link AuthenticationCeremonySequence}
 */
export function sequence(...components: AuthenticationCeremony[]): AuthenticationCeremonySequence {
	return { kind: "sequence", components };
}

/**
 * Create a {@link AuthenticationCeremonyChoice} of components.
 * @param components Array of {@link AuthenticationCeremony}
 * @returns The {@link AuthenticationCeremonyChoice}
 */
export function choice(...components: AuthenticationCeremony[]): AuthenticationCeremonyChoice {
	return { kind: "choice", components };
}

/**
 * Create a {@link AuthenticationCeremonyComponent}.
 * @param component The component name
 * @returns The {@link AuthenticationCeremonyComponent}
 */
export function component(component: string): AuthenticationCeremonyComponent {
	return { kind: "component", component };
}

/** Zod schema for {@link AuthenticationCeremonyComponent}. */
export const AuthenticationCeremonyComponent = z.strictObject({
	kind: z.literal("component"),
	component: z.string(),
}).meta({ id: "AuthenticationCeremonyComponent" });

/** Zod schema for {@link AuthenticationCeremony}. */
export const AuthenticationCeremony = z.lazy(() =>
	z.union([
		AuthenticationCeremonyComponent,
		AuthenticationCeremonySequence,
		AuthenticationCeremonyChoice,
	]).meta({
		id: "AuthenticationCeremony",
	})
);

/** Zod schema for {@link AuthenticationCeremonySequence}. */
export const AuthenticationCeremonySequence = z.strictObject({
	kind: z.literal("sequence"),
	get components(): z.ZodArray<typeof AuthenticationCeremony> {
		return z.array(AuthenticationCeremony);
	},
}).meta({ id: "AuthenticationCeremonySequence" });

/** Zod schema for {@link AuthenticationCeremonyChoice}. */
export const AuthenticationCeremonyChoice = z.strictObject(
	{
		kind: z.literal("choice"),
		get components(): z.ZodArray<typeof AuthenticationCeremony> {
			return z.array(AuthenticationCeremony);
		},
	},
).meta(
	{ id: "AuthenticationCeremonyChoice" },
);

/** Zod schema for {@link AuthenticationCeremonySequenceShallow}. */
export const AuthenticationCeremonySequenceShallow = z.strictObject({
	kind: z.literal("sequence"),
	components: z.array(AuthenticationCeremonyComponent),
}).meta({ id: "AuthenticationCeremonySequenceShallow" });

/** Zod schema for {@link AuthenticationCeremonyChoiceShallow}. */
export const AuthenticationCeremonyChoiceShallow = z.strictObject({
	kind: z.literal("choice"),
	components: z.array(AuthenticationCeremonyComponent),
}).meta({ id: "AuthenticationCeremonyChoiceShallow" });

/**
 * Check if the value is an {@link AuthenticationCeremonyComponent}
 * @param value The value to test
 * @returns Whether the value is an {@link AuthenticationCeremonyComponent}
 */
export function isAuthenticationCeremonyComponent(
	value: unknown,
): value is AuthenticationCeremonyComponent {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "component" && "component" in value && typeof value.component === "string";
}

/**
 * Check if the value is an {@link AuthenticationCeremonySequence}
 * @param value The value to test
 * @returns Whether the value is an {@link AuthenticationCeremonySequence}
 */
export function isAuthenticationCeremonySequence(
	value: unknown,
): value is AuthenticationCeremonySequence {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "sequence" && "components" in value && Array.isArray(value.components) &&
		value.components.every(isAuthenticationCeremony);
}

/**
 * Check if the value is an {@link AuthenticationCeremonyChoice}
 * @param value The value to test
 * @returns Whether the value is an {@link AuthenticationCeremonyChoice}
 */
export function isAuthenticationCeremonyChoice(
	value: unknown,
): value is AuthenticationCeremonyChoice {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "choice" && "components" in value && Array.isArray(value.components) &&
		value.components.every(isAuthenticationCeremony);
}

/**
 * Check if the value is an {@link AuthenticationCeremonySequenceShallow}
 * @param value The value to test
 * @returns Whether the value is an {@link AuthenticationCeremonySequenceShallow}
 */
export function isAuthenticationCeremonySequenceShallow(
	value: unknown,
): value is AuthenticationCeremonySequenceShallow {
	return isAuthenticationCeremonySequence(value) &&
		value.components.every(isAuthenticationCeremonyComponent);
}

/**
 * Check if the value is an {@link AuthenticationCeremonyChoiceShallow}
 * @param value The value to test
 * @returns Whether the value is an {@link AuthenticationCeremonyChoiceShallow}
 */
export function isAuthenticationCeremonyChoiceShallow(
	value: unknown,
): value is AuthenticationCeremonyChoiceShallow {
	return isAuthenticationCeremonyChoice(value) &&
		value.components.every(isAuthenticationCeremonyComponent);
}

/**
 * Check if the value is an {@link AuthenticationCeremony}.
 * @param value The value to test
 * @returns Whether the value is an {@link AuthenticationCeremony}
 */
export function isAuthenticationCeremony(value: unknown): value is AuthenticationCeremony {
	return isAuthenticationCeremonyComponent(value) || isAuthenticationCeremonySequence(value) ||
		isAuthenticationCeremonyChoice(value);
}

/**
 * Compare two {@link AuthenticationCeremony} for equality.
 * @param a A {@link AuthenticationCeremony} to compare
 * @param b A {@link AuthenticationCeremony} to compare
 * @returns Whether the two {@link AuthenticationCeremony} are equal
 */
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

/**
 * Extract {@link AuthenticationCeremonyComponent} from the {@link AuthenticationCeremony}.
 * @param ceremony The {@link AuthenticationCeremony} to extract {@link AuthenticationCeremonyComponent} from
 * @returns Array of {@link AuthenticationCeremonyComponent}
 */
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

/**
 * Simplify the {@link AuthenticationCeremony} by removing unnecessary nesting and duplicate component.
 * @param ceremony The {@link AuthenticationCeremony} to simplify
 * @returns Siplified {@link AuthenticationCeremony}
 */
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
		const uniqueComponents = components.filter((c, i) => components.findIndex(isAuthenticationCeremonyEquals.bind(null, c)) === i);
		if (uniqueComponents.length === 1) {
			return uniqueComponents[0];
		}
		return ceremony.kind === "sequence" ? sequence(...uniqueComponents) : choice(...uniqueComponents);
	}
	return ceremony;
}

/**
 * Walk the {@link AuthenticationCeremony} and yield each {@link AuthenticationCeremonyComponent} with its parents.
 * @param ceremony The {@link AuthenticationCeremony}
 * @yields A tuple of the {@link AuthenticationCeremonyComponent} and its parents
 *
 * If the first element of the tuple is `null`, it means the end of the ceremony.
 */
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
			if (isAuthenticationCeremonySequenceShallow(ceremony)) {
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

/**
 * Get {@link AuthenticationCeremonyComponent} at the given path.
 * @param ceremony The {@link AuthenticationCeremony}
 * @param path The path to the component
 * @returns The {@link AuthenticationCeremony} at the path, or `true` if the path is at the end of the ceremony, or `undefined` if the path is not found.
 */
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
