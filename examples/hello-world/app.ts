import { collection, document, onRequest, Permission, topic, Type } from "@baseless/server";
import "./server.gen.ts";

export const onHelloWorld = onRequest(
	"hello",
	Type.String(),
	Type.String(),
	({ input }) => `Hello ${input}`,
	() => Permission.Fetch,
);

export const fooCollection = collection("foo", Type.String(), Type.Object({ name: Type.String() }), () => Permission.All);
export const barDocument = document("bar", Type.Object({ name: Type.String() }), () => Permission.All);
export const pingTopic = topic("ping", Type.String(), () => Permission.All);
