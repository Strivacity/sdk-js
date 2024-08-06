import type { SDKOptions, PopupWindowParams } from '../types';
import { popupCallbackHandler, popupUrlHandler } from '../utils/handlers';
import { isBrowser } from '../utils/constants';
import { State } from '../State';
import { BaseFlow } from './BaseFlow';

export class PopupFlow extends BaseFlow<SDKOptions, PopupWindowParams> {
	async login(options: PopupWindowParams = {}): Promise<void> {
		if (!isBrowser) {
			return;
		}

		const state = await State.create();
		const url = await this.getAuthorizationUrl(options);

		url.searchParams.append('state', state.id);
		url.searchParams.append('code_challenge', state.codeChallenge);
		url.searchParams.append('nonce', state.nonce);
		url.searchParams.append('display', 'popup');

		this.storage.set(`sty.${state.id}`, JSON.stringify(state));

		this.dispatchEvent('loginInitiated', []);

		const data = await this.urlHandler(url, options);

		await this.exchangeCodeForTokens(data);

		if (this.accessToken && this.idTokenClaims) {
			this.dispatchEvent('loggedIn', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
		}
	}

	async register(options: PopupWindowParams = {}): Promise<void> {
		if (!isBrowser) {
			return;
		}

		options.prompt = 'create';

		await this.login(options);
	}

	async handleCallback(): Promise<void> {
		popupCallbackHandler(this.options.responseMode || 'fragment');
	}

	async urlHandler(url: URL, options?: PopupWindowParams): Promise<Record<string, string>> {
		return popupUrlHandler(url, options);
	}
}
