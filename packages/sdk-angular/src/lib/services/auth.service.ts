import { Inject, Injectable } from '@angular/core';
import { type Observable, BehaviorSubject, from } from 'rxjs';
import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
import type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';
import { type SDKOptions, initFlow } from '@strivacity/sdk-core';
import type { Session } from '../utils/types';
import { STRIVACITY_SDK } from '../utils/helpers';

/**
 * Service that manages Strivacity authentication flows.
 * Supports either PopupFlow or RedirectFlow types.
 *
 * @template Flow Type of authentication flow (PopupFlow or RedirectFlow).
 * @template Options Type of SDK options (defaults to SDKOptions).
 */
@Injectable({
	providedIn: 'root',
})
export class StrivacityAuthService<
	Flow extends PopupFlow | RedirectFlow | NativeFlow = PopupFlow | RedirectFlow | NativeFlow,
	Options extends SDKOptions = SDKOptions,
> {
	/**
	 * Instance of the authentication flow (PopupFlow or RedirectFlow).
	 */
	sdk: Flow;

	/**
	 * BehaviorSubject that holds the current session state.
	 * @protected
	 * @readonly
	 */
	private readonly sessionSubject: BehaviorSubject<Session>;

	/**
	 * Observable that emits the session state changes.
	 * @readonly
	 */
	readonly session$: Observable<Session>;

	/**
	 * Creates an instance of StrivacityAuthService.
	 *
	 * @param {Options} options SDK configuration options injected via STRIVACITY_SDK.
	 */
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

	/**
	 * Checks if the user is authenticated.
	 *
	 * @returns {Observable<boolean>} An observable that emits the authentication status.
	 */
	isAuthenticated() {
		return from(this.sdk.isAuthenticated);
	}

	/**
	 * Logs the user in using the specified options.
	 *
	 * @param {Parameters<Flow['login']>[0]} [options] Options to customize the login behavior.
	 * @returns {Observable<void>} An observable that completes when the login process is done.
	 */
	login(options?: Parameters<Flow['login']>[0]) {
		const result = this.sdk.login(options);

		if (result instanceof Promise) {
			return from(result);
		}

		return result;
	}

	/**
	 * Initiates the entry process using the provided challenge.
	 *
	 * @param {string} [url] Optional URL to use for the entry process. If not provided, the current window location will be used.
	 * @returns {Observable<void>} An observable that completes when the entry process is done.
	 */
	entry(url?: string) {
		const result = this.sdk.entry(url);

		if (result instanceof Promise) {
			return from(result);
		}

		return result;
	}

	/**
	 * Registers a new user using the specified options.
	 *
	 * @param {Parameters<Flow['register']>[0]} [options] Options to customize the registration behavior.
	 * @returns {Observable<void>} An observable that completes when the registration process is done.
	 */
	register(options?: Parameters<Flow['register']>[0]) {
		const result = this.sdk.register(options);

		if (result instanceof Promise) {
			return from(result);
		}

		return result;
	}

	/**
	 * Refreshes the current authentication session.
	 *
	 * @returns {Observable<void>} An observable that completes when the session is refreshed.
	 */
	refresh() {
		return from(this.sdk.refresh());
	}

	/**
	 * Revokes the current session tokens.
	 *
	 * @returns {Observable<void>} An observable that completes when the tokens are revoked.
	 */
	revoke() {
		return from(this.sdk.revoke());
	}

	/**
	 * Logs the user out using the specified options.
	 *
	 * @param {Parameters<Flow['logout']>[0]} [options] Options to customize the logout behavior.
	 * @returns {Observable<void>} An observable that completes when the logout process is done.
	 */
	logout(options?: Parameters<Flow['logout']>[0]) {
		return from(this.sdk.logout(options));
	}

	/**
	 * Handles the authentication callback (e.g., after a redirect or popup flow).
	 *
	 * @param {Parameters<Flow['handleCallback']>[0]} [url] The URL to handle for the callback.
	 * @returns {Observable<void>} An observable that completes when the callback is handled.
	 */
	handleCallback(url?: Parameters<Flow['handleCallback']>[0]) {
		return from(this.sdk.handleCallback(url));
	}
}
