import { collection, document, onRequest, Permission, topic, Type } from "@baseless/server";
import "./server.gen.ts";

export const onHelloWorld = onRequest(
	"hello",
	Type.String(),
	Type.String(),
	({ input }) => `Hello ${input}`,
	() => Permission.Fetch,
);

export const Foo = collection("foo", Type.String(), Type.Object({ name: Type.String() }), () => Permission.All);
export const Bar = document("bar", Type.Object({ name: Type.String() }), () => Permission.All);
export const Ping = topic("ping", Type.String(), () => Permission.All);
