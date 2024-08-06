import type { SDKOptions, RedirectParams } from '../types';
import { redirectUrlHandler, redirectCallbackHandler } from '../utils/handlers';
import { isBrowser } from '../utils/constants';
import { State } from '../State';
import { BaseFlow } from './BaseFlow';

export class RedirectFlow extends BaseFlow<SDKOptions, RedirectParams> {
	async login(options: RedirectParams = {}): Promise<void> {
		if (!isBrowser) {
			return;
		}

		const state = await State.create();
		const url = await this.getAuthorizationUrl(options);

		url.searchParams.append('state', state.id);
		url.searchParams.append('code_challenge', state.codeChallenge);
		url.searchParams.append('nonce', state.nonce);

		this.storage.set(`sty.${state.id}`, JSON.stringify(state));

		this.dispatchEvent('loginInitiated', []);

		await this.urlHandler(url, options);
	}

	async register(options: RedirectParams = {}): Promise<void> {
		if (!isBrowser) {
			return;
		}

		options.prompt = 'create';

		await this.login(options);
	}

	async handleCallback(url?: string): Promise<void> {
		if (!url) {
			url = globalThis.window?.location.href;
		}

		await this.exchangeCodeForTokens(redirectCallbackHandler(url, this.options.responseMode || 'fragment'));

		if (this.accessToken && this.idTokenClaims) {
			this.dispatchEvent('loggedIn', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
		}
	}

	async urlHandler(url: URL, options?: RedirectParams): Promise<void> {
		return await redirectUrlHandler(url, options);
	}
}
