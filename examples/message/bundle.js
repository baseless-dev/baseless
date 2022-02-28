// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

const __default = {
    fetch (req, env, ctx) {
        const url = new URL(req.url);
        const paths = url.pathname.slice(1).split("/");
        if (paths.length === 0) {
            return new Response("Needs a path", {
                status: 400
            });
        }
        if (req.headers.get("Upgrade") != "websocket") {
            return new Response("Upgrade to websocket?", {
                status: 400
            });
        }
        const ref = paths.join("/");
        console.log(`ref=${ref}`);
        const id = env.CHANNELS.idFromName(ref);
        console.log(`id=${id}`);
        const channel = env.CHANNELS.get(id);
        const newUrl = new URL(req.url);
        newUrl.pathname = "abcd1234";
        console.log(newUrl);
        return channel.fetch(newUrl, req);
    }
};
class Channel {
    constructor(state, env){
        this.state = state;
        this.env = env;
        this.participants = new Set();
        this.nextParticipantId = 0;
    }
    fetch(req) {
        const url = new URL(req.url);
        const userId = url.pathname.slice(1);
        const pair = new WebSocketPair();
        const client = pair[0];
        const webSocket = pair[1];
        webSocket.accept();
        const participant = {
            userId,
            webSocket,
            metadata: {}
        };
        this.participants.add(participant);
        function closeOrError() {
            this.participants.delete(participant);
            this.broadcast({
                quit: userId
            });
        }
        webSocket.addEventListener("close", closeOrError);
        webSocket.addEventListener("error", closeOrError);
        webSocket.addEventListener("message", (event)=>{
            this.broadcast(event.data);
        });
        webSocket.send(JSON.stringify({
            hello: true
        }));
        return new Response(null, {
            status: 101,
            webSocket: client
        });
    }
    broadcast(msg) {
        if (typeof msg !== "string") {
            msg = JSON.stringify(msg);
        }
        const participants = new Set(this.participants);
        const dropped = new Set();
        for (const participant of participants){
            try {
                participant.webSocket.send(msg);
            } catch (_err) {
                this.participants.delete(participant);
                dropped.add(participant);
            }
        }
        for (const { userId  } of dropped){
            this.broadcast({
                quit: {
                    userId
                }
            });
        }
    }
}
export { __default as default };
export { Channel as Channel };
