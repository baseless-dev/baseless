import { assertEquals } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { MessageBuilder } from "./message.ts";

Deno.test("channel ref", () => {
	const builder = new MessageBuilder();
	builder.channel("/foo");
	assertEquals({
		channels: [{
			ref: "/foo",
			matcher: /^\/foo$/,
			onCreate: undefined,
			onMessage: undefined,
			onEmpty: undefined,
			permission: undefined,
		}],
	}, builder.build());
});

// type Room = { topic: string };
// type RoomParticipant = { displayName: string; status: string };

// messages.channel<Room, RoomParticipant>("/rooms/:room")
// 	// Everyone can join and send
// 	.permission(ChannelPermissions.Join | ChannelPermissions.Send)
// 	// When channel is created, set topic
// 	.onCreate(async (_, channel) => {
// 		channel.metadata.topic = "New channel";
// 	})
// 	// When participant is connected...
// 	//   1. set display name & status
// 	//   2. broadcast new participant has joined
// 	//   3. send others info to participant
// 	.onConnect(async (_, channel, participant) => {
// 		participant.metadata.displayName = "New nick";
// 		participant.metadata.status = "online";
// 		channel.broadcast(
// 			JSON.stringify({ type: "joined", participant: { id: participant.id, metadata: participant.metadata } }),
// 		);
// 		for (const other of channel.participants) {
// 			participant.webSocket.send(JSON.stringify({ type: "participant", id: other.id, metadata: other.metadata }));
// 		}
// 	})
// 	// When participant is disconnected, broadcast that participant has left
// 	.onDisconnect(async (_, channel, participant) => {
// 		channel.broadcast(JSON.stringify({ type: "left", participantId: participant.id }));
// 	})
// 	// When a participant send message
// 	.onMessage(async (_, channel, participant, message) => {
// 		const msg = JSON.parse(message.toString());
// 		// Broadcast message to all participant
// 		if (msg.type === "talk") {
// 			channel.broadcast(JSON.stringify({ type: "talk", from: participant.id, message: msg.message }));
// 		} // Participant changed his displayName, broadcast changes
// 		else if (msg.type === "displayName") {
// 			participant.metadata.displayName = msg.displayName;
// 			channel.broadcast(
// 				JSON.stringify({ type: "displayName", id: participant.id, displayName: participant.metadata.displayName }),
// 			);
// 		} // Participant changed his status, broadcast changes
// 		else if (msg.type === "status") {
// 			participant.metadata.status = msg.status;
// 			channel.broadcast(JSON.stringify({ type: "status", id: participant.id, status: participant.metadata.status }));
// 		}
// 	});
