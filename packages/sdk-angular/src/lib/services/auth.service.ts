import { Inject, Injectable } from '@angular/core';
import { type Observable, BehaviorSubject, from } from 'rxjs';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import { type SDKOptions, initFlow } from '@strivacity/sdk-core';
import type { Session } from '../utils/types';
import { STRIVACITY_SDK } from '../utils/helpers';

@Injectable({
	providedIn: 'root',
})
export class StrivacityAuthService<Flow extends PopupFlow | RedirectFlow = PopupFlow | RedirectFlow, Options extends SDKOptions = SDKOptions> {
	protected sdk: Flow;
	private readonly sessionSubject: BehaviorSubject<Session>;
	readonly session$: Observable<Session>;

	constructor(@Inject(STRIVACITY_SDK) public options: Options) {
		this.sdk = initFlow(options) as Flow;
		this.sessionSubject = new BehaviorSubject<Session>({
			loading: true,
			isAuthenticated: false,
			idTokenClaims: null,
			accessToken: null,
			refreshToken: null,
			accessTokenExpired: true,
			accessTokenExpirationDate: null,
		});
		this.session$ = this.sessionSubject.asObservable();

		const updateSession = async () => {
			this.sessionSubject.next({
				loading: false,
				isAuthenticated: await this.sdk.isAuthenticated,
				idTokenClaims: this.sdk.idTokenClaims || null,
				accessToken: this.sdk.accessToken || null,
				refreshToken: this.sdk.refreshToken || null,
				accessTokenExpired: this.sdk.accessTokenExpired,
				accessTokenExpirationDate: this.sdk.accessTokenExpirationDate || null,
			});
		};

		this.sdk.subscribeToEvent('init', updateSession);
		this.sdk.subscribeToEvent('loggedIn', updateSession);
		this.sdk.subscribeToEvent('sessionLoaded', updateSession);
		this.sdk.subscribeToEvent('tokenRefreshed', updateSession);
		this.sdk.subscribeToEvent('tokenRefreshFailed', updateSession);
		this.sdk.subscribeToEvent('logoutInitiated', updateSession);
		this.sdk.subscribeToEvent('tokenRevoked', updateSession);
		this.sdk.subscribeToEvent('tokenRevokeFailed', updateSession);
	}

	isAuthenticated() {
		return from(this.sdk.isAuthenticated);
	}

	login(options?: Parameters<Flow['login']>[0]) {
		return from(this.sdk.login(options));
	}

	register(options?: Parameters<Flow['register']>[0]) {
		return from(this.sdk.register(options));
	}

	refresh() {
		return from(this.sdk.refresh());
	}

	revoke() {
		return from(this.sdk.revoke());
	}

	logout(options?: Parameters<Flow['logout']>[0]) {
		return from(this.sdk.logout(options));
	}

	handleCallback(url?: Parameters<Flow['handleCallback']>[0]) {
		return from(this.sdk.handleCallback(url));
	}
}
