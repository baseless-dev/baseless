import { assertJsonObject, type JsonObject } from "../../common/system/json.ts";

export async function getJsonData(request: Request): Promise<JsonObject> {
	if (request.headers.get("content-type") === "application/json") {
		const body = await request.text();
		const data = JSON.parse(body);
		assertJsonObject(data);
		return data;
	}
	return {};
}
