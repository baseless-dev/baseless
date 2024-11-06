/**
 * Log level
 */
export const LogLevel = {
	DEBUG: "DEBUG",
	LOG: "LOG",
	INFO: "INFO",
	WARN: "WARN",
	ERROR: "ERROR",
	CRITICAL: "CRITICAL",
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

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
} as Record<keyof typeof LogLevel, number>;

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

const LogLevelConsoleMethod = {
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
	const logSeverityConsoleColor = {
		[LogLevel.DEBUG]: "gray",
		[LogLevel.LOG]: "green",
		[LogLevel.INFO]: "cyan",
		[LogLevel.WARN]: "yellow",
		[LogLevel.ERROR]: "red",
		[LogLevel.CRITICAL]: "pink",
	} as const;
	return (ns, lvl, msg) => {
		if (LogSeverity[lvl] >= minSeverity) {
			const color = logSeverityConsoleColor[lvl];
			LogLevelConsoleMethod[lvl](
				`%c${new Date().toISOString()} %c ${lvl} %c ${ns} ${msg} `,
				`color: ${color};`,
				`background-color: ${color}; color: white; font-weight: bold;`,
				`color: ${color};`,
			);
		}
	};
}

/**
 * Log handler that void every message
 */
export const voidLogHandler: LogHandler = () => {};

interface GlobalThisExt {
	__BASELESS_CORE_LOGGER_globalLogHandler: LogHandler;
}

(globalThis as unknown as GlobalThisExt).__BASELESS_CORE_LOGGER_globalLogHandler ??= voidLogHandler;

/**
 * Set global logger handler
 * @param logHandler The log handler
 */
export function setGlobalLogHandler(logHandler?: LogHandler): void {
	(globalThis as unknown as GlobalThisExt).__BASELESS_CORE_LOGGER_globalLogHandler = logHandler ?? voidLogHandler;
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
export function createLogger(namespace: string): Logger {
	return Object.fromEntries(
		Object.keys(LogLevel).map((
			lvl,
		) => [
			lvl.toLowerCase(),
			(msg: string) =>
				(globalThis as unknown as GlobalThisExt).__BASELESS_CORE_LOGGER_globalLogHandler(namespace, lvl as LogLevel, msg),
		]),
	) as unknown as Logger;
}

const defaultLogger: Logger = createLogger("default");

export const debug = defaultLogger.debug;
export const log = defaultLogger.log;
export const info = defaultLogger.info;
export const warn = defaultLogger.warn;
export const error = defaultLogger.error;
export const critical = defaultLogger.critical;
