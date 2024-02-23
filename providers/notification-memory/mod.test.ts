import testNotificationProvider from "../notification.test.ts";
import { MemoryNotificationProvider } from "./mod.ts";

Deno.test("MemoryNotificationProvider", async (t) => {
	const np = new MemoryNotificationProvider();
	await testNotificationProvider(np, "", t, () => {
		const msg = np.notifications.pop();
		if (msg) {
			return Promise.resolve(msg);
		}
		return Promise.reject(new Error("No notification"));
	});
});
