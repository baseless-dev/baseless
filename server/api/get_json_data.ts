import { assertJsonRecord, type JsonRecord } from "../../common/system/json.ts";

export async function getJsonData(request: Request): Promise<JsonRecord> {
	if (request.headers.get("content-type") === "application/json") {
		const body = await request.text();
		const data = JSON.parse(body);
		assertJsonRecord(data);
		return data;
	}
	return {};
}
