export interface IAssetService {
	fetch(request: Request): Promise<Response>;
}
