import type { KyInstance } from 'ky';
import type { IdTokenClaims, SDKOptions, SDKStorage, EventFunctions, ExtraRequestArgs, LogoutOptions } from '../types';
import { isBrowser } from '../utils/constants';
import { jwt } from '../utils/jwt';
import { fetch } from '../utils/fetch';
import { timestamp } from '../utils/date';
import { Metadata } from '../Metadata';
import { Session } from '../Session';
import { State } from '../State';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventCallbacks: Record<keyof EventFunctions, Set<(...args: Array<any>) => Promise<void> | void>> = {
	accessTokenExpired: new Set(),
	init: new Set(),
	loggedIn: new Set(),
	loginInitiated: new Set(),
	logoutInitiated: new Set(),
	sessionLoaded: new Set(),
	tokenRefreshed: new Set(),
	tokenRefreshFailed: new Set(),
	tokenRevoked: new Set(),
	tokenRevokeFailed: new Set(),
};

/**
 * An abstract base class that provides common functionality for different OIDC flows.
 *
 * @template Options - The options type extending `SDKOptions` used for configuring the flow.
 * @template URLHandlerOptions - The options type extending `ExtraRequestArgs` used for URL handling.
 */
export abstract class BaseFlow<Options extends SDKOptions, URLHandlerOptions extends ExtraRequestArgs> {
	/**
	 * A promise that resolves to indicate whether authentication has been verified.
	 *
	 * @type {Promise<boolean> | null}
	 */
	protected isAuthPromise: Promise<boolean> | null = null;

	/**
	 * An instance of the HTTP client used for making requests.
	 *
	 * @type {KyInstance}
	 */
	protected httpClient!: KyInstance;

	/**
	 * The configuration options for the flow.
	 *
	 * @type {Options}
	 */
	protected options: Options;

	/**
	 * The storage mechanism used to persist session data.
	 *
	 * @type {SDKStorage}
	 */
	protected storage: SDKStorage;

	/**
	 * Metadata information about the authorization server.
	 *
	 * @type {Metadata}
	 */
	protected metadata: Metadata;

	/**
	 * The current session data.
	 *
	 * @type {Session | null}
	 */
	protected session: Session | null = null;

	/**
	 * Retrieves the ID token claims from the current session.
	 *
	 * @type {IdTokenClaims | null | undefined}
	 */
	get idTokenClaims(): IdTokenClaims | null | undefined {
		return this.session?.claims;
	}

	/**
	 * Retrieves the access token from the current session.
	 *
	 * @type {string | null | undefined}
	 */
	get accessToken(): string | null | undefined {
		return this.session?.access_token;
	}

	/**
	 * Retrieves the refresh token from the current session.
	 *
	 * @type {string | null | undefined}
	 */
	get refreshToken(): string | null | undefined {
		return this.session?.refresh_token;
	}

	/**
	 * Determines if the access token has expired.
	 *
	 * @type {boolean}
	 */
	get accessTokenExpired(): boolean {
		return !this.session?.expires_at || this.session.expires_at <= timestamp();
	}

	/**
	 * Retrieves the access token expiration date.
	 *
	 * @type {number | null | undefined}
	 */
	get accessTokenExpirationDate(): number | null | undefined {
		return this.session?.expires_at;
	}

	/**
	 * Checks if the user is authenticated by evaluating the presence of access or refresh tokens.
	 *
	 * @returns {Promise<boolean>} - A promise that resolves to `true` if the user is authenticated, otherwise `false`.
	 */
	get isAuthenticated(): Promise<boolean> {
		if (this.isAuthPromise) {
			return this.isAuthPromise;
		}

		// eslint-disable-next-line no-async-promise-executor
		this.isAuthPromise = new Promise(async (resolve) => {
			try {
				if (this.refreshToken && this.accessTokenExpired) {
					await this.refresh();
				}
			} catch {}

			setTimeout(() => {
				resolve(!!this.session?.access_token || !!this.session?.refresh_token);
				this.isAuthPromise = null;
			});
		});

		return this.isAuthPromise;
	}

	/**
	 * Constructs a new instance of the `BaseFlow` class.
	 *
	 * @param {Options} options - Configuration options for the flow.
	 * @param {SDKStorage} storage - Storage mechanism for session data.
	 *
	 * @throws {Error} Throws an error if required options are missing or invalid.
	 */
	constructor(options: Options, storage: SDKStorage) {
		if (!options.issuer) {
			throw Error('Missing option: issuer');
		}
		if (!options.clientId) {
			throw Error('Missing option: clientId');
		}
		if (!options.redirectUri) {
			throw Error('Missing option: redirectUri');
		}
		if (options.scopes && !Array.isArray(options.scopes)) {
			throw Error('Invalid option: scopes');
		}

		if (!options.scopes) {
			options.scopes = ['openid'];
		}
		if (!options.responseType) {
			options.responseType = 'code';
		}
		if (!options.responseMode) {
			options.responseMode = 'query';
		}
		if (!options.storageTokenName) {
			options.storageTokenName = 'sty.session';
		}

		this.httpClient = fetch.create({ retry: 0 });
		this.options = options as Options;
		this.storage = storage;
		this.metadata = new Metadata(`${options.issuer}/.well-known/openid-configuration`);
		this.session = Session.load(this.storage.get(this.options.storageTokenName as string));

		setTimeout(() => {
			this.dispatchEvent('init', []);

			if (this.session && this.accessToken && this.idTokenClaims) {
				this.dispatchEvent('sessionLoaded', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
			}

			if (this.accessToken && this.accessTokenExpired) {
				this.dispatchEvent('accessTokenExpired', [{ accessToken: this.accessToken, refreshToken: this.refreshToken }]);
			}
		});
	}

	/**
	 * Initiates the login process. Subclasses should implement this method to handle the specific login flow.
	 *
	 * @param {URLHandlerOptions} [options] - Additional options for handling URLs during login.
	 * @returns {Promise<void>} - A promise that resolves when the login process is complete.
	 */
	abstract login(options?: URLHandlerOptions): Promise<void>;

	/**
	 * Registers a new user. Subclasses should implement this method to handle the specific registration flow.
	 *
	 * @param {URLHandlerOptions} [options] - Additional options for handling URLs during registration.
	 * @returns {Promise<void>} - A promise that resolves when the registration process is complete.
	 */
	abstract register(options?: URLHandlerOptions): Promise<void>;

	/**
	 * Logs out the current user and optionally redirects to a post-logout URI.
	 *
	 * @param {URLHandlerOptions & LogoutOptions} [options] - Additional options for handling URLs during logout.
	 * @returns {Promise<void>} - A promise that resolves when the logout process is complete.
	 */
	async logout(options?: URLHandlerOptions & LogoutOptions): Promise<void> {
		if (!isBrowser) {
			return;
		}

		const session = this.session;

		this.storage.delete(this.options.storageTokenName as string);
		this.session = null;

		if (session?.id_token) {
			const url = new URL(await this.metadata.endSessionEndpoint);

			url.searchParams.append('id_token_hint', session?.id_token);

			if (options?.postLogoutRedirectUri) {
				url.searchParams.append('post_logout_redirect_uri', options.postLogoutRedirectUri);
			}

			this.dispatchEvent('logoutInitiated', [{ idToken: session.id_token, claims: session.claims as IdTokenClaims }]);

			try {
				await this.urlHandler(url, options as URLHandlerOptions);
			} catch {}
		}
	}

	/**
	 * Refreshes the access token using the refresh token.
	 *
	 * @returns {Promise<void>} - A promise that resolves when the token refresh is complete.
	 *
	 * @throws {Error} Throws an error if no refresh token is available or if the refresh fails.
	 */
	async refresh(): Promise<void> {
		if (typeof this.session?.refresh_token !== 'string') {
			throw Error('No refresh token available');
		}

		const session = this.session;

		try {
			const request = await this.sendTokenRequest(await this.metadata.tokenEndpoint, {
				grant_type: 'refresh_token',
				client_id: this.options.clientId,
				refresh_token: this.session?.refresh_token,
			});

			Object.assign(this.session, await request.json());

			if (this.session.id_token) {
				this.session.claims = jwt.decode<IdTokenClaims>(this.session.id_token);
			}

			this.storage.set(this.options.storageTokenName as string, JSON.stringify(this.session));

			if (this.accessToken && this.refreshToken && this.idTokenClaims) {
				this.dispatchEvent('tokenRefreshed', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
			}
		} catch {
			this.session = null;
			this.storage.delete(this.options.storageTokenName as string);

			this.dispatchEvent('tokenRefreshFailed', [{ refreshToken: session.refresh_token as string }]);
		}
	}

	/**
	 * Revokes the current access or refresh token.
	 *
	 * @returns {Promise<void>} - A promise that resolves when the token revocation is complete.
	 */
	async revoke(): Promise<void> {
		const session = this.session;
		let success = true;

		try {
			if (session?.refresh_token) {
				await this.sendTokenRequest(await this.metadata.revocationEndpoint, {
					client_id: this.options.clientId,
					token_type_hint: 'refresh_token',
					token: session.refresh_token,
				});
			} else if (session?.access_token) {
				await this.sendTokenRequest(await this.metadata.revocationEndpoint, {
					client_id: this.options.clientId,
					token_type_hint: 'access_token',
					token: session.access_token,
				});
			}
		} catch {
			success = false;
		} finally {
			this.session = null;
			this.storage.delete(this.options.storageTokenName as string);

			if (session?.refresh_token) {
				this.dispatchEvent(success ? 'tokenRevoked' : 'tokenRevokeFailed', [{ token: session.refresh_token as string, tokenTypeHint: 'refresh_token' }]);
			} else if (session?.access_token) {
				this.dispatchEvent(success ? 'tokenRevoked' : 'tokenRevokeFailed', [{ token: session.access_token as string, tokenTypeHint: 'access_token' }]);
			}
		}
	}

	/**
	 * Exchanges an authorization code for access and refresh tokens.
	 *
	 * @param {Record<string, string>} [params={}] - Parameters containing the authorization code and other required values.
	 * @returns {Promise<void>} - A promise that resolves when the token exchange is complete.
	 *
	 * @throws {Error} Throws an error if the authorization code is invalid or if there are issues with state, nonce, or tokens.
	 */
	async exchangeCodeForTokens(params: Record<string, string> = {}): Promise<void> {
		this.session = new Session();

		Object.assign(this.session, params);

		if (this.session.error) {
			throw Error(`${this.session.error}: ${this.session.error_description}`);
		}
		if (!this.session.code) {
			throw Error('Invalid or missing code');
		}

		let state: State;

		try {
			const serializedState = this.storage.get(`sty.${this.session.state}`);

			if (!serializedState) {
				throw Error();
			}

			state = State.fromSerializedData(serializedState);

			this.storage.delete(`sty.${this.session.state}`);
		} catch {
			throw Error('Invalid or missing state');
		}

		const request = await this.sendTokenRequest(await this.metadata.tokenEndpoint, {
			grant_type: 'authorization_code',
			client_id: this.options.clientId,
			redirect_uri: this.options.redirectUri,
			code_verifier: state.codeVerifier,
			code: this.session.code,
		});

		Object.assign(this.session, await request.json());

		if (this.session.id_token) {
			this.session.claims = jwt.decode<IdTokenClaims>(this.session.id_token);
		}

		if (this.session.scope !== this.options.scopes?.join(' ')) {
			throw Error('Invalid scope');
		}
		if (this.session.claims?.nonce !== state.nonce) {
			throw Error('Invalid nonce');
		}
		if (this.session.claims?.iss !== (await this.metadata.issuer)) {
			throw Error('Invalid iss');
		}
		if (Array.isArray(this.session.claims?.aud) ? this.session.claims?.aud[0] !== this.options.clientId : this.session.claims?.aud !== this.options.clientId) {
			throw Error('Invalid aud');
		}

		this.storage.set(this.options.storageTokenName as string, JSON.stringify(this.session));
	}

	/**
	 * Subscribes a callback function to an event.
	 *
	 * @param {T} eventName - The name of the event to subscribe to.
	 * @param {(...params: Parameters<EventFunctions[T]>) => Promise<void> | void} callbackFn - The callback function to execute when the event is dispatched.
	 * @returns {{ dispose: () => void }} - An object with a `dispose` method to remove the subscription.
	 */
	subscribeToEvent<T extends keyof EventFunctions>(
		eventName: T,
		callbackFn: (...params: Parameters<EventFunctions[T]>) => Promise<void> | void,
	): { dispose: () => void } {
		eventCallbacks[eventName].add(callbackFn);

		return {
			dispose: () => {
				eventCallbacks[eventName].delete(callbackFn);
			},
		};
	}

	/**
	 * Dispatches an event to all subscribed callback functions.
	 *
	 * @param {T} eventName - The name of the event to dispatch.
	 * @param {Parameters<EventFunctions[T]>} args - The arguments to pass to the callback functions.
	 */
	protected dispatchEvent<T extends keyof EventFunctions>(eventName: T, args: Parameters<EventFunctions[T]>): void {
		for (const eventFn of eventCallbacks[eventName]) {
			void eventFn(...args);
		}
	}

	/**
	 * Constructs the authorization URL for initiating the authorization flow.
	 *
	 * @param {ExtraRequestArgs} [options={}] - Additional options to include in the authorization URL.
	 * @returns {Promise<URL>} - A promise that resolves to the constructed authorization URL.
	 */
	protected async getAuthorizationUrl(options: ExtraRequestArgs = {}): Promise<URL> {
		const url = new URL(await this.metadata.authorizationEndpoint);

		url.searchParams.append('client_id', this.options.clientId);
		url.searchParams.append('redirect_uri', this.options.redirectUri);
		url.searchParams.append('response_type', this.options.responseType || 'code');
		url.searchParams.append('response_mode', this.options.responseMode || 'fragment');
		url.searchParams.append('scope', this.options.scopes?.join(' ') as string);
		url.searchParams.append('code_challenge_method', 'S256');

		if (options.prompt) {
			url.searchParams.append('prompt', options.prompt);
		}
		if (options.acrValues) {
			url.searchParams.append('acr_values', options.acrValues.join(' '));
		}
		if (options.loginHint) {
			url.searchParams.append('login_hint', options.loginHint);
		}
		if (options.uiLocales) {
			url.searchParams.append('ui_locales', options.uiLocales.join(' '));
		}

		return url;
	}

	/**
	 * Handles URL redirections for authentication and authorization processes.
	 *
	 * @param {string | URL} url - The URL to handle.
	 * @param {URLHandlerOptions} [options] - Additional options for URL handling.
	 * @returns {Promise<unknown>} - A promise that resolves when the URL handling is complete.
	 */
	protected abstract urlHandler(url: string | URL, options?: URLHandlerOptions): Promise<unknown>;

	/**
	 * Sends a token request to the specified URL with the given data.
	 *
	 * @param {string | URL} url - The URL to send the request to.
	 * @param {Record<string, string>} [data={}] - The data to include in the request body.
	 * @returns {Promise<Response>} - A promise that resolves to the response from the request.
	 */
	protected async sendTokenRequest(url: string | URL, data: Record<string, string> = {}): Promise<Response> {
		return await this.httpClient.post(url, {
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(data),
		});
	}
}
