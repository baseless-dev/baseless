/**
 * Log level
 */
export enum LogLevel {
	DEBUG = "DEBUG",
	LOG = "LOG",
	INFO = "INFO",
	WARN = "WARN",
	ERROR = "ERROR",
	CRITICAL = "CRITICAL",
}

/**
 * Log severity by their level
 */
export const LogSeverity = {
	[LogLevel.DEBUG]: 0,
	[LogLevel.LOG]: 1,
	[LogLevel.INFO]: 2,
	[LogLevel.WARN]: 3,
	[LogLevel.ERROR]: 4,
	[LogLevel.CRITICAL]: 5,
} as const;

/**
 * Log handler function
 */
export type LogHandler = (
	/**
	 * Namespace of the caller
	 */
	namespace: string,
	/**
	 * Level of the log
	 */
	level: LogLevel,
	/**
	 * Message of the log
	 */
	message: string,
) => void;

export const LogLevelMethod = {
	[LogLevel.DEBUG]: "debug",
	[LogLevel.LOG]: "log",
	[LogLevel.INFO]: "info",
	[LogLevel.WARN]: "warn",
	[LogLevel.ERROR]: "error",
	[LogLevel.CRITICAL]: "critical",
} as const;

const logSeverityConsoleMethodMap = {
	[LogLevel.DEBUG]: console.debug,
	[LogLevel.LOG]: console.log,
	[LogLevel.INFO]: console.info,
	[LogLevel.WARN]: console.warn,
	[LogLevel.ERROR]: console.error,
	[LogLevel.CRITICAL]: console.error,
} as const;

/**
 * Create a log handler pipe message to the {@link Console}.
 *
 * For example let's create a console log handle that only print ERROR and CRITICAL logs:
 * ```ts
 * import { createConsoleLogHandler } from "./logger.ts"
 *
 * createConsoleLogHandler(LogLevel.ERROR)
 * ```
 *
 * @param minSeverity Determines the minimum {@link LogSeverity} to log
 * @returns The log handler
 */
export function createConsoleLogHandler(minLevel = LogLevel.DEBUG): LogHandler {
	const minSeverity = LogSeverity[minLevel];
	return (ns, lvl, msg) => {
		if (LogSeverity[lvl] >= minSeverity) {
			logSeverityConsoleMethodMap[lvl](`${new Date().toISOString()} [${ns.padEnd(25, " ")}] [${lvl.padEnd(8, " ")}] ${msg}`);
		}
	};
}

/**
 * Log handler that void every message
 */
export const voidLogHandler: LogHandler = () => {};

let globalLogHandler: LogHandler = voidLogHandler;

/**
 * Set global logger handler
 * @param logHandler The log handler
 */
export function setGlobalLogHandler(logHandler?: LogHandler) {
	globalLogHandler = logHandler ?? voidLogHandler;
}

/**
 * Logger interface used to emit message at different level
 */
export interface Logger {
	debug(message: string): void;
	log(message: string): void;
	info(message: string): void;
	warn(message: string): void;
	error(message: string): void;
	critical(message: string): void;
}

/**
 * Creates a Logger object
 * @param namespace The namespace to prefix all message
 * @returns The logger
 */
export function logger(namespace: string): Logger {
	return Object.fromEntries(
		Object.keys(LogLevel).map((lvl) => [lvl.toLowerCase(), (msg: string) => globalLogHandler(namespace, lvl as LogLevel, msg)]),
	) as unknown as Logger;
}

const defaultLogger = logger("default");

export const debug = defaultLogger.debug;
export const log = defaultLogger.log;
export const info = defaultLogger.info;
export const warn = defaultLogger.warn;
export const error = defaultLogger.error;
export const critical = defaultLogger.critical;
