import { trace } from "@opentelemetry/api";

export default trace.getTracer("@baseless/deno-provider");
