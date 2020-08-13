import { request } from './functions';
import { StrivacityClientOptions, Consent } from './types';
import {
	BASE_URL,
	DEFAULT_TIMEOUT,
} from './constants';

export default class AnonymousIdentityConsent {
	private readonly timeout: number = DEFAULT_TIMEOUT;
	private readonly url: string;

	constructor(options: StrivacityClientOptions) {
		this.timeout = options.timeout || DEFAULT_TIMEOUT;
		this.url = options.url;
	}

	async getConsents(identityId: string, session: string, options: RequestInit = {}, timeout: number = this.timeout): Promise<Consent[]> {
		if (!identityId) {
			throw new Error('getConsents :: identityId must be provided');
		}

		if (!session) {
			throw new Error('getConsents :: session must be provided');
		}

		options = {
			headers: {
				'X-SESSION': session,
			},
			...options,
		};

		return await request('GET', `${this.url}/${BASE_URL}/identities/${identityId}/consents`, undefined, options, timeout);
	}

	async createConsent(identityId: string, body: Consent, options: RequestInit = {}, timeout: number = this.timeout): Promise<Consent> {
		if (!identityId) {
			throw new Error('createConsent :: identityId must be provided');
		}

		return await request('POST', `${this.url}/${BASE_URL}/identities/${identityId}/consents`, body, options, timeout);
	}

	async checkConsentById(identityId: string, id: string, options: RequestInit = {}, timeout: number = this.timeout): Promise<void> {
		if (!identityId) {
			throw new Error('checkConsentById :: identityId must be provided');
		}

		if (!id) {
			throw new Error('checkConsentById :: id must be provided');
		}

		return await request('HEAD', `${this.url}/${BASE_URL}/identities/${identityId}/consents/${id}`, undefined, options, timeout);
	}

	async getConsentById(identityId: string, id: string, session: string, options: RequestInit = {}, timeout: number = this.timeout): Promise<Consent> {
		if (!identityId) {
			throw new Error('getConsentById :: identityId must be provided');
		}

		if (!id) {
			throw new Error('getConsentById :: id must be provided');
		}

		if (!session) {
			throw new Error('getConsentById :: session must be provided');
		}

		options = {
			headers: {
				'X-SESSION': session,
			},
			...options,
		};

		return await request('GET', `${this.url}/${BASE_URL}/identities/${identityId}/consents/${id}`, undefined, options, timeout);
	}

	async deleteConsentById(identityId: string, id: string, options: RequestInit = {}, timeout: number = this.timeout): Promise<void> {
		if (!identityId) {
			throw new Error('deleteConsentById :: identityId must be provided');
		}

		if (!id) {
			throw new Error('deleteConsentById :: id must be provided');
		}

		return await request('DELETE', `${this.url}/${BASE_URL}/identities/${identityId}/consents/${id}`, undefined, options, timeout);
	}
}
