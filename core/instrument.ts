import type { Span, Tracer } from "@opentelemetry/api";

export type Instrument = <T>(
	name: string,
	attributes: Record<string, string | number | boolean | string[]> | undefined,
	fn: (span: Span) => T | Promise<T>,
) => Promise<T>;

/**
 * Starts an active span with the given name, sets optional attributes, runs
 * the callback, and handles the canonical error-recording + span-end
 * boilerplate on every exit path.
 */
export function instrument(tracer: Tracer): Instrument {
	return <T>(
		name: string,
		attributes: Record<string, string | number | boolean | string[]> | undefined,
		fn: (span: Span) => T | Promise<T>,
	): Promise<T> => {
		return tracer.startActiveSpan(name, async (span) => {
			if (attributes) {
				for (const [key, value] of Object.entries(attributes)) {
					span.setAttribute(key, value);
				}
			}
			try {
				return await fn(span);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	};
}
