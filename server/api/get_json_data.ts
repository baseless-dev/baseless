import { assertSchema } from "../../common/schema/types.ts";
import { type JsonRecord, JsonRecordSchema } from "../../common/system/json.ts";

export async function getJsonData(request: Request): Promise<JsonRecord> {
	if (request.headers.get("content-type") === "application/json") {
		const body = await request.text();
		const data = JSON.parse(body);
		assertSchema(JsonRecordSchema, data);
		return data;
	}
	return {};
}
