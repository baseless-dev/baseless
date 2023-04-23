import { LoggerMessageProvider } from "./mod.ts";
import testMessageProvider from "../message.test.ts";
import { Message } from "../message.ts";
import { setGlobalLogHandler } from "../../logger.ts";

Deno.test("KVSessionProvider", async (t) => {
	const mp = new LoggerMessageProvider();
	const messages: { ns: string; lvl: string; message: Message }[] = [];
	setGlobalLogHandler((ns, lvl, msg) => {
		messages.push({ ns, lvl, message: JSON.parse(msg)! });
	});
	// deno-lint-ignore require-await
	await testMessageProvider(mp, t, async () => {
		const msg = messages.pop();
		if (msg) {
			return Promise.resolve(msg.message);
		}
		return Promise.reject(new Error("No message"));
	});
	setGlobalLogHandler(() => { });
});
