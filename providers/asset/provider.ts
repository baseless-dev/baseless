export interface AssetProvider {
	fetch(request: Request): Promise<Response>;
}
