import type { MetadataOptions } from './types';
import { fetch } from './utils/fetch';

export class Metadata {
	protected data: MetadataOptions | null = null;

	get issuer(): Promise<string> {
		return this.getMetadataProperty('issuer');
	}
	get authorizationEndpoint(): Promise<string> {
		return this.getMetadataProperty('authorization_endpoint');
	}
	get tokenEndpoint(): Promise<string> {
		return this.getMetadataProperty('token_endpoint');
	}
	get userinfoEndpoint(): Promise<string> {
		return this.getMetadataProperty('userinfo_endpoint');
	}
	get endSessionEndpoint(): Promise<string> {
		return this.getMetadataProperty('end_session_endpoint');
	}
	get revocationEndpoint(): Promise<string> {
		return this.getMetadataProperty('revocation_endpoint');
	}
	get jwksUri(): Promise<string> {
		return this.getMetadataProperty('jwks_uri');
	}

	constructor(protected metadataUrl: string) {}

	async fetchMetadata(): Promise<void> {
		this.data = await fetch.get(this.metadataUrl).json<MetadataOptions>();
	}

	async getMetadataProperty<K extends keyof MetadataOptions>(key: K): Promise<MetadataOptions[K]> {
		if (this.data?.[key]) {
			return Promise.resolve(this.data[key]);
		}

		await this.fetchMetadata();

		return Promise.resolve((this.data as MetadataOptions)[key]);
	}
}
