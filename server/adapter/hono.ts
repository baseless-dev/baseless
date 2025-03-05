import { Hono } from "hono";
import { Server } from "../server.ts";

export default function hono(baseless: Server) {
	return new Hono();
}
