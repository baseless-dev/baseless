export type Logger = (
	namespace: string,
	level: string,
	message: string,
) => void;

let globalLogger: Logger = (ns, lvl, msg) => {
	console.log(`${new Date().toISOString()} [${ns}] ${lvl} ${msg}`);
};

export function createLogger(logger: Logger) {
	globalLogger = logger;
}

export function logger(namespace: string) {
	return {
		debug: (message: string) => {
			globalLogger(namespace, "debug", message);
		},
		log: (message: string) => {
			globalLogger(namespace, "debug", message);
		},
		info: (message: string) => {
			globalLogger(namespace, "debug", message);
		},
		warn: (message: string) => {
			globalLogger(namespace, "debug", message);
		},
		error: (message: string) => {
			globalLogger(namespace, "debug", message);
		},
	};
}

const defaultLogger = logger("default");

export const debug = defaultLogger.debug;
export const log = defaultLogger.log;
export const info = defaultLogger.info;
export const warn = defaultLogger.warn;
export const error = defaultLogger.error;
