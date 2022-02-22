export enum LogLevel {
	DEBUG = "DEBUG",
	LOG = "LOG",
	INFO = "INFO",
	WARN = "WARN",
	ERROR = "ERROR",
	CRITICAL = "CRITICAL",
}

export const LogSeverity = {
	[LogLevel.DEBUG]: 0,
	[LogLevel.LOG]: 1,
	[LogLevel.INFO]: 2,
	[LogLevel.WARN]: 3,
	[LogLevel.ERROR]: 4,
	[LogLevel.CRITICAL]: 5,
};

export type Logger = (
	namespace: string,
	level: LogLevel,
	message: string,
) => void;

let globalLogger: Logger = () => {};

export function createLogger(logger: Logger = () => {}) {
	globalLogger = logger;
}

export function logger(namespace: string) {
	return {
		debug: (message: string) => {
			globalLogger(namespace, LogLevel.DEBUG, message);
		},
		log: (message: string) => {
			globalLogger(namespace, LogLevel.LOG, message);
		},
		info: (message: string) => {
			globalLogger(namespace, LogLevel.INFO, message);
		},
		warn: (message: string) => {
			globalLogger(namespace, LogLevel.WARN, message);
		},
		error: (message: string) => {
			globalLogger(namespace, LogLevel.ERROR, message);
		},
		critical: (message: string) => {
			globalLogger(namespace, LogLevel.CRITICAL, message);
		},
	};
}

const defaultLogger = logger("default");

export const debug = defaultLogger.debug;
export const log = defaultLogger.log;
export const info = defaultLogger.info;
export const warn = defaultLogger.warn;
export const error = defaultLogger.error;
export const critical = defaultLogger.critical;
