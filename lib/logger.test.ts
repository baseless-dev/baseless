import { assertEquals } from "../deps.test.ts";
import {
	createLogger,
	critical,
	debug,
	error,
	info,
	log,
	setGlobalLogHandler,
	voidLogHandler,
	warn,
} from "./logger.ts";

Deno.test("log message with global method in default namespace", () => {
	const logs: { ns: string; lvl: string; msg: string }[] = [];
	setGlobalLogHandler((ns, lvl, msg) => {
		logs.push({ ns, lvl, msg });
	});
	log("a");
	info("b");
	debug("c");
	warn("d");
	error("e");
	critical("f");
	assertEquals(logs, [
		{ ns: "default", lvl: "LOG", msg: "a" },
		{ ns: "default", lvl: "INFO", msg: "b" },
		{ ns: "default", lvl: "DEBUG", msg: "c" },
		{ ns: "default", lvl: "WARN", msg: "d" },
		{ ns: "default", lvl: "ERROR", msg: "e" },
		{ ns: "default", lvl: "CRITICAL", msg: "f" },
	]);
	setGlobalLogHandler(voidLogHandler);
});

Deno.test("log message with named logger", () => {
	const logs: { ns: string; lvl: string; msg: string }[] = [];
	setGlobalLogHandler((ns, lvl, msg) => {
		logs.push({ ns, lvl, msg });
	});
	const l = createLogger("test");
	l.log("a");
	l.info("b");
	l.debug("c");
	l.warn("d");
	l.error("e");
	l.critical("f");
	assertEquals(logs, [
		{ ns: "test", lvl: "LOG", msg: "a" },
		{ ns: "test", lvl: "INFO", msg: "b" },
		{ ns: "test", lvl: "DEBUG", msg: "c" },
		{ ns: "test", lvl: "WARN", msg: "d" },
		{ ns: "test", lvl: "ERROR", msg: "e" },
		{ ns: "test", lvl: "CRITICAL", msg: "f" },
	]);
	setGlobalLogHandler(voidLogHandler);
});

Deno.test("reset logger", () => {
	setGlobalLogHandler(voidLogHandler);
});
