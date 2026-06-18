import { trace } from "@opentelemetry/api";
import { instrument } from "@baseless/core/instrument";

const tracer = trace.getTracer("@baseless/deno-provider");
export default tracer;

export const traced = instrument(tracer);
