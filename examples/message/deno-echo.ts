import { serve } from "https://deno.land/std/http/mod.ts";
function handleMessage(ws: WebSocket, data: string) {
	ws.send(data);
}
function reqHandler(req: Request) {
	if (req.headers.get("upgrade") != "websocket") {
		return new Response(null, { status: 501 });
	}
	const { socket: ws, response } = Deno.upgradeWebSocket(req);
	ws.onopen = () => console.log("Client connected");
	ws.onmessage = (m) => handleMessage(ws, m.data);
	ws.onclose = () => console.log("Server closed");
	ws.onerror = (e) => console.error("Server error", e);
	return response;
}
console.log("Waiting for client ...");
serve(reqHandler, { port: 8000 });
