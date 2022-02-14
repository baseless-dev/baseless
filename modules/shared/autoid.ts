/**
 * Generate an autoid
 */
export function autoid(length = 20) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	let autoid = "";
	const buffer = new Uint8Array(length);
	crypto.getRandomValues(buffer);
	for (let i = 0; i < length; ++i) {
		autoid += chars.charAt(buffer[i] % chars.length);
	}
	return autoid;
}
