import type { MetadataOptions } from './types';
import { fetch } from './utils/fetch';

/**
 * Class responsible for fetching and handling metadata for authentication endpoints.
 */
export class Metadata {
	/**
	 * Holds the metadata options once fetched, or null if not yet fetched.
	 * @protected
	 */
	protected data: MetadataOptions | null = null;

	/**
	 * Retrieves the issuer metadata.
	 *
	 * @returns {Promise<string>} A promise that resolves to the issuer string.
	 */
	get issuer(): Promise<string> {
		return this.getMetadataProperty('issuer');
	}

	/**
	 * Retrieves the authorization endpoint metadata.
	 *
	 * @returns {Promise<string>} A promise that resolves to the authorization endpoint URL.
	 */
	get authorizationEndpoint(): Promise<string> {
		return this.getMetadataProperty('authorization_endpoint');
	}

	/**
	 * Retrieves the token endpoint metadata.
	 *
	 * @returns {Promise<string>} A promise that resolves to the token endpoint URL.
	 */
	get tokenEndpoint(): Promise<string> {
		return this.getMetadataProperty('token_endpoint');
	}

	/**
	 * Retrieves the user info endpoint metadata.
	 *
	 * @returns {Promise<string>} A promise that resolves to the user info endpoint URL.
	 */
	get userinfoEndpoint(): Promise<string> {
		return this.getMetadataProperty('userinfo_endpoint');
	}

	/**
	 * Retrieves the end session endpoint metadata.
	 *
	 * @returns {Promise<string>} A promise that resolves to the end session endpoint URL.
	 */
	get endSessionEndpoint(): Promise<string> {
		return this.getMetadataProperty('end_session_endpoint');
	}

	/**
	 * Retrieves the revocation endpoint metadata.
	 *
	 * @returns {Promise<string>} A promise that resolves to the revocation endpoint URL.
	 */
	get revocationEndpoint(): Promise<string> {
		return this.getMetadataProperty('revocation_endpoint');
	}

	/**
	 * Retrieves the JWKS URI metadata.
	 *
	 * @returns {Promise<string>} A promise that resolves to the JWKS URI.
	 */
	get jwksUri(): Promise<string> {
		return this.getMetadataProperty('jwks_uri');
	}

	/**
	 * Creates an instance of the Metadata class.
	 *
	 * @param {string} metadataUrl The URL to fetch metadata from.
	 */
	constructor(protected metadataUrl: URL) {}

	/**
	 * Fetches and updates the metadata from the specified URL.
	 *
	 * @returns {Promise<void>} A promise that resolves once the metadata is fetched.
	 */
	async fetchMetadata(): Promise<void> {
		this.data = await fetch.get(this.metadataUrl).json<MetadataOptions>();
	}

	/**
	 * Retrieves a specific metadata property.
	 *
	 * @template K The key of the metadata property.
	 * @param {K} key The metadata property key to retrieve.
	 * @returns {Promise<MetadataOptions[K]>} A promise that resolves to the value of the specified metadata property.
	 */
	async getMetadataProperty<K extends keyof MetadataOptions>(key: K): Promise<MetadataOptions[K]> {
		if (this.data?.[key]) {
			return Promise.resolve(this.data[key]);
		}

		await this.fetchMetadata();

		return Promise.resolve((this.data as MetadataOptions)[key]);
	}
}
