import { s } from "../../schema/mod.ts";
import type { Infer, Schema } from "../../schema/types.ts";
import { IContext } from "../../server/context.ts";
import { AuthenticationCeremonyStateSchema } from "./state.ts";

export type AuthenticationCeremonyComponentIdentification = {
	kind: "identification";
	id: string;
	prompt: "email" | "action";
};
export type AuthenticationCeremonyComponentChallenge = {
	kind: "challenge";
	id: string;
	prompt: "password" | "otp";
};
export type AuthenticationCeremonyComponentSequence = {
	kind: "sequence";
	components: AuthenticationCeremonyComponent[];
};
export type AuthenticationCeremonyComponentChoice = {
	kind: "choice";
	components: AuthenticationCeremonyComponent[];
};
export type AuthenticationCeremonyComponentConditional = {
	kind: "conditional";
	condition: (
		context: IContext,
		state: Infer<typeof AuthenticationCeremonyStateSchema>,
	) =>
		| AuthenticationCeremonyComponent
		| Promise<AuthenticationCeremonyComponent>;
};
export type AuthenticationCeremonyComponent =
	| AuthenticationCeremonyComponentIdentification
	| AuthenticationCeremonyComponentChallenge
	| AuthenticationCeremonyComponentSequence
	| AuthenticationCeremonyComponentChoice
	| AuthenticationCeremonyComponentConditional;

export const AuthenticationCeremonyComponentIdentificationSchema = s.object({
	kind: s.literal("identification"),
	id: s.string(),
	prompt: s.choice(["email", "action"]),
});
export const AuthenticationCeremonyComponentChallengeSchema = s.object({
	kind: s.literal("challenge"),
	id: s.string(),
	prompt: s.choice(["password", "otp"]),
});
export const AuthenticationCeremonyComponentSequenceSchema = s.lazy(() =>
	s.object({
		kind: s.literal("sequence"),
		components: s.array(AuthenticationCeremonyComponentSchema),
	})
);
export const AuthenticationCeremonyComponentChoiceSchema = s.lazy(() =>
	s.object({
		kind: s.literal("choice"),
		components: s.array(AuthenticationCeremonyComponentSchema),
	})
);
export const AuthenticationCeremonyComponentConditionalSchema = s.lazy(() =>
	s.object({
		kind: s.literal("conditional"),
		condition: s.func<
			[
				context: IContext,
				state: Infer<typeof AuthenticationCeremonyStateSchema>,
			],
			AuthenticationCeremonyComponent | Promise<AuthenticationCeremonyComponent>
		>(),
	})
);
export const AuthenticationCeremonyComponentSchema: Schema<
	AuthenticationCeremonyComponent
> = s.union([
	AuthenticationCeremonyComponentIdentificationSchema,
	AuthenticationCeremonyComponentChallengeSchema,
	AuthenticationCeremonyComponentSequenceSchema,
	AuthenticationCeremonyComponentChoiceSchema,
	AuthenticationCeremonyComponentConditionalSchema,
]);
