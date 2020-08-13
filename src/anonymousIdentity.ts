import { request } from './functions';
import { StrivacityClientOptions, Identity, Attribute } from './types';
import {
	BASE_URL,
	DEFAULT_TIMEOUT,
} from './constants';
import AnonymousIdentityConsent from './anonymousIdentityConsent';

export default class AnonymousIdentity {
	public consent: AnonymousIdentityConsent;

	private readonly timeout: number = DEFAULT_TIMEOUT;
	private readonly url: string;

	constructor(options: StrivacityClientOptions) {
		this.timeout = options.timeout || DEFAULT_TIMEOUT;
		this.url = options.url;

		this.consent = new AnonymousIdentityConsent(options);
	}

	async createIdentity(body: Attribute, options: RequestInit = {}, timeout: number = this.timeout): Promise<Identity> {
		return await request('POST', `${this.url}/${BASE_URL}/identities`, body, options, timeout);
	}

	async checkIdentityById(id: string, options: RequestInit = {}, timeout: number = this.timeout): Promise<void> {
		if (!id) {
			throw new Error('checkIdentityById :: id must be provided');
		}

		return await request('HEAD', `${this.url}/${BASE_URL}/identities/${id}`, undefined, options, timeout);
	}

	async getIdentityById(id: string, session: string, options: RequestInit = {}, timeout: number = this.timeout): Promise<Identity> {
		if (!id) {
			throw new Error('getIdentityById :: id must be provided');
		}

		if (!session) {
			throw new Error('getIdentityById :: session must be provided');
		}

		options = {
			headers: {
				'X-SESSION': session,
			},
			...options,
		};

		return await request('GET', `${this.url}/${BASE_URL}/identities/${id}`, undefined, options, timeout);
	}

	async deleteIdentityById(id: string, options: RequestInit = {}, timeout: number = this.timeout): Promise<void> {
		if (!id) {
			throw new Error('deleteIdentityById :: id must be provided');
		}

		return await request('DELETE', `${this.url}/${BASE_URL}/identities/${id}`, undefined, options, timeout);
	}
}
