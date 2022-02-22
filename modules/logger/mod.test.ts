import { assertEquals, assertNotEquals } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { createLogger, critical, debug, error, info, log, logger, warn } from "./mod.ts";

Deno.test("log message with global method in default namespace", () => {
	const logs: string[] = [];
	createLogger((ns, lvl, msg) => {
		logs.push([ns, lvl, msg].join("|"));
	});
	log("a");
	info("b");
	debug("c");
	warn("d");
	error("e");
	critical("f");
	assertEquals(logs, [
		"default|LOG|a",
		"default|INFO|b",
		"default|DEBUG|c",
		"default|WARN|d",
		"default|ERROR|e",
		"default|CRITICAL|f",
	]);
});

Deno.test("log message with named logger", () => {
	const logs: string[] = [];
	createLogger((ns, lvl, msg) => {
		logs.push([ns, lvl, msg].join("|"));
	});
	const l = logger("test");
	l.log("a");
	l.info("b");
	l.debug("c");
	l.warn("d");
	l.error("e");
	l.critical("f");
	assertEquals(logs, ["test|LOG|a", "test|INFO|b", "test|DEBUG|c", "test|WARN|d", "test|ERROR|e", "test|CRITICAL|f"]);
});

Deno.test("reset logger", () => {
	createLogger(undefined);
	log("a");
	info("b");
	debug("c");
	warn("d");
	error("e");
	critical("f");
});
