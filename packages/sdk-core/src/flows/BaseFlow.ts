import type {
	IdTokenClaims,
	SDKOptions,
	SDKStorage,
	EventFunctions,
	ExtraRequestArgs,
	LogoutParams,
	SDKHttpClient,
	HttpClientResponse,
	SDKLogging,
} from '../types';
import { jwt } from '../utils/jwt';
import { timestamp } from '../utils/date';
import { Metadata } from '../utils/Metadata';
import { Session } from '../utils/Session';
import { State } from '../utils/State';

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
 * @template URLHandlerParams - The options type extending `ExtraRequestArgs` used for URL handling.
 */
export abstract class BaseFlow<Options extends SDKOptions = SDKOptions, URLHandlerParams extends ExtraRequestArgs = ExtraRequestArgs> {
	/**
	 * @ignore
	 */
	#initializationPromise: Promise<void>;

	/**
	 * @ignore
	 */
	#isAuthenticatedPromise: Promise<boolean> | null = null;

	/**
	 * Indicates whether a token refresh operation is currently in progress.
	 *
	 * @type {boolean}
	 */
	#refreshInProgressState = false;

	/**
	 * An instance of the HTTP client used for making requests.
	 *
	 * @type {SDKHttpClient}
	 */
	httpClient: SDKHttpClient;

	/**
	 * The storage mechanism used to persist session data.
	 *
	 * @type {SDKStorage}
	 */
	storage: SDKStorage;

	/**
	 * Logging utility for the SDK.
	 */
	logging?: SDKLogging;

	/**
	 * Metadata information about the authorization server.
	 *
	 * @type {Metadata}
	 */
	metadata: Metadata;

	/**
	 * The current session data.
	 *
	 * @type {Session | null}
	 */
	session: Session | null = null;

	/**
	 * The configuration options for the flow.
	 *
	 * @type {Options}
	 */
	options: Options;

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
	 * Indicates whether a token refresh operation is currently in progress.
	 *
	 * @type {boolean}
	 */
	get refreshInProgress(): boolean {
		return this.#refreshInProgressState;
	}

	/**
	 * Determines if the access token has expired.
	 *
	 * @type {boolean}
	 */
	get accessTokenExpired(): boolean {
		return !this.session?.access_token || !this.session?.expires_at || this.session.expires_at <= timestamp();
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
		if (this.#isAuthenticatedPromise) {
			return this.#isAuthenticatedPromise;
		}

		this.#isAuthenticatedPromise = this.#checkAuthentication();

		return this.#isAuthenticatedPromise;
	}

	/**
	 * Checks authentication status without attempting token refresh.
	 * Useful when you want to avoid side effects.
	 *
	 * @returns {boolean} - Returns `true` if the user has a valid, non-expired access token.
	 */
	get isAuthenticatedSync(): boolean {
		return Boolean(this.session?.access_token && !this.accessTokenExpired);
	}

	/**
	 * Constructs a new instance of the `BaseFlow` class.
	 *
	 * @param {Options} options - Configuration options for the flow.
	 * @param {SDKStorage} storage - Storage mechanism for session data.
	 * @param {SDKHttpClient} httpClient - HTTP client for making requests.
	 * @param {SDKLogging} [logging] - Optional logging utility.
	 *
	 * @throws {Error} Throws an error if required options are missing or invalid.
	 */
	constructor(options: Options, storage: SDKStorage, httpClient: SDKHttpClient, logging?: SDKLogging) {
		if (!options.issuer) {
			const error = new Error('Missing option: issuer');
			logging?.error('Required option missing', error);
			throw error;
		}
		if (!options.clientId) {
			const error = new Error('Missing option: clientId');
			logging?.error('Required option missing', error);
			throw error;
		}
		if (!options.redirectUri) {
			const error = new Error('Missing option: redirectUri');
			logging?.error('Required option missing', error);
			throw error;
		}
		if (!options.urlHandler) {
			const error = new Error('Missing option: urlHandler');
			logging?.error('Required option missing', error);
			throw error;
		}
		if (!options.callbackHandler) {
			const error = new Error('Missing option: callbackHandler');
			logging?.error('Required option missing', error);
			throw error;
		}
		if (options.scopes && !Array.isArray(options.scopes)) {
			const error = new Error('Invalid option: scopes');
			logging?.error('Invalid option provided', error);
			throw error;
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

		this.options = options;
		this.storage = storage;
		this.httpClient = httpClient;
		this.logging = logging;
		this.metadata = new Metadata(this, new URL('/.well-known/openid-configuration', options.issuer).toString());

		this.#initializationPromise = this.#init();
	}

	/**
	 * Initializes the flow by loading the session from storage and setting up event listeners.
	 * @ignore
	 */
	async #init() {
		this.session = Session.load(await this.storage.get(this.options.storageTokenName!));

		this.dispatchEvent('init', []);
		this.logging?.debug('SDK initialized');

		if (!this.session) {
			this.logging?.debug('No session found in storage');
		}

		if (this.session && this.accessToken && this.idTokenClaims) {
			this.dispatchEvent('sessionLoaded', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
			this.logging?.debug('Session loaded from storage');
		}

		if (this.accessToken && this.accessTokenExpired) {
			this.dispatchEvent('accessTokenExpired', [{ accessToken: this.accessToken, refreshToken: this.refreshToken }]);
			this.logging?.debug('Access token has expired');
		}
	}

	/**
	 * Internal method to check authentication status with proper error handling.
	 * @ignore
	 */
	async #checkAuthentication(): Promise<boolean> {
		let isAuthenticated = false;

		try {
			await this.waitToInitialize();
		} catch {
			this.logging?.warn('Initialization failed');
		}

		// Attempt to refresh the token if it has expired
		if (this.accessTokenExpired && this.refreshToken && !this.refreshInProgress) {
			try {
				this.#refreshInProgressState = true;
				await this.refresh();
			} catch {
				// Token refresh failed - if you want to log errors use the tokenRefreshFailed event
			} finally {
				this.#refreshInProgressState = false;
			}
		}

		if (!this.accessTokenExpired) {
			isAuthenticated = true;
		}

		this.#isAuthenticatedPromise = null;

		return isAuthenticated;
	}

	/**
	 * Initiates the login process. Subclasses should implement this method to handle the specific login flow.
	 *
	 * @param {URLHandlerParams} [params] - Additional params for handling URLs during login.
	 * @returns {Promise<void>} - A promise that resolves when the login process is complete.
	 */
	abstract login(params?: URLHandlerParams): unknown;

	/**
	 * Registers a new user. Subclasses should implement this method to handle the specific registration flow.
	 *
	 * @param {URLHandlerParams} [params] - Additional params for handling URLs during registration.
	 * @returns {Promise<void>} - A promise that resolves when the registration process is complete.
	 */
	abstract register(params?: URLHandlerParams): unknown;

	/**
	 * Initiates the entry process.
	 * @param {string} url Optional URL to use for the entry process. If not provided, the current window location will be used.
	 * @returns {Promise<void>} A promise that resolves when the entry process completes.
	 */
	abstract entry(url?: string): unknown;

	/**
	 * Logs out the current user and optionally redirects to a post-logout URI.
	 *
	 * @param {URLHandlerParams & LogoutParams} [params] - Additional params for handling URLs during logout.
	 * @returns {Promise<void>} - A promise that resolves when the logout process is complete.
	 *
	 * @throws {Error} Throws an error if URL handler is not defined.
	 */
	async logout(params?: URLHandlerParams & LogoutParams): Promise<void> {
		if (typeof this.options.urlHandler !== 'function') {
			const error = new Error('Missing option: urlHandler');
			this.logging?.error('Required option missing', error);
			throw error;
		}

		await this.waitToInitialize();

		this.logging?.debug('Attempting to logout');

		const session = this.session;

		if (!session?.id_token) {
			this.logging?.debug('Logout called without session');
			return;
		}

		await this.storage.delete(this.options.storageTokenName!);
		this.session = null;

		const url = new URL(await this.metadata.endSessionEndpoint);

		url.searchParams.append('id_token_hint', session?.id_token);

		if (params?.postLogoutRedirectUri) {
			url.searchParams.append('post_logout_redirect_uri', params.postLogoutRedirectUri);
		}

		this.dispatchEvent('logoutInitiated', [{ idToken: session.id_token, claims: session.claims! }]);
		this.logging?.debug('Logout initiated');

		await this.options.urlHandler(url.toString(), params as URLHandlerParams);
	}

	/**
	 * Refreshes the access token using the refresh token.
	 *
	 * @returns {Promise<void>} - A promise that resolves when the token refresh is complete.
	 */
	async refresh(): Promise<void> {
		await this.waitToInitialize();

		this.logging?.debug('Attempting to refresh session');

		if (typeof this.session?.refresh_token !== 'string') {
			this.logging?.debug('Session refresh not possible - session not found');
			return;
		}

		const session = this.session;

		try {
			const response = await this.sendTokenRequest<Session>(await this.metadata.tokenEndpoint, {
				grant_type: 'refresh_token',
				client_id: this.options.clientId,
				refresh_token: this.session?.refresh_token,
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(`${data.error}: ${data.error_description}`);
			}

			Object.assign(this.session, await response.json());

			if (this.session.id_token) {
				this.session.claims = jwt.decode<IdTokenClaims>(this.session.id_token);
			}

			await this.storage.set(this.options.storageTokenName!, JSON.stringify(this.session));

			if (this.accessToken && this.refreshToken && this.idTokenClaims) {
				this.dispatchEvent('tokenRefreshed', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
				this.logging?.info('Session refreshed successfully');
			}
		} catch (error) {
			this.session = null;
			await this.storage.delete(this.options.storageTokenName!);

			this.dispatchEvent('tokenRefreshFailed', [{ refreshToken: session.refresh_token! }]);
			this.logging?.info(`Session refresh failed - ${error}`);
		}
	}

	/**
	 * Revokes the current access or refresh token.
	 *
	 * @returns {Promise<void>} - A promise that resolves when the token revocation is complete.
	 */
	async revoke(): Promise<void> {
		await this.waitToInitialize();

		const session = this.session;
		let success = true;

		try {
			let response: HttpClientResponse<Record<string, string>> | undefined;

			if (session?.refresh_token) {
				this.logging?.debug('Attempting to revoke refresh token');

				response = await this.sendTokenRequest(await this.metadata.revocationEndpoint, {
					client_id: this.options.clientId,
					token_type_hint: 'refresh_token',
					token: session.refresh_token,
				});
			} else if (session?.access_token) {
				this.logging?.debug('Attempting to revoke access token');

				response = await this.sendTokenRequest(await this.metadata.revocationEndpoint, {
					client_id: this.options.clientId,
					token_type_hint: 'access_token',
					token: session.access_token,
				});
			}

			if (response && !response.ok) {
				const data = await response.json();
				throw new Error(`${data.error}: ${data.error_description}`);
			}
		} catch (error) {
			success = false;
			this.logging?.info(`Token revocation failed - ${error}`);
		} finally {
			this.session = null;
			await this.storage.delete(this.options.storageTokenName!);

			if (session?.refresh_token) {
				this.dispatchEvent(success ? 'tokenRevoked' : 'tokenRevokeFailed', [{ token: session.refresh_token, tokenTypeHint: 'refresh_token' }]);

				if (success) {
					this.logging?.info('Refresh token successfully revoked');
				}
			} else if (session?.access_token) {
				this.dispatchEvent(success ? 'tokenRevoked' : 'tokenRevokeFailed', [{ token: session.access_token, tokenTypeHint: 'access_token' }]);

				if (success) {
					this.logging?.info('Access token successfully revoked');
				}
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
	async tokenExchange(params: Record<string, string> = {}): Promise<void> {
		await this.waitToInitialize();

		this.logging?.debug('Exchanging authorization code for tokens');

		this.session = new Session();

		Object.assign(this.session, params);

		if (this.session.error) {
			const error = new Error(`${this.session.error}: ${this.session.error_description}`);
			this.logging?.error('Authorization error', error);
			throw error;
		}
		if (!this.session.code) {
			const error = new Error('Invalid or missing code');
			this.logging?.error('Authorization error', error);
			throw error;
		}

		let state: State;

		try {
			const serializedState = await this.storage.get(`sty.${this.session.state}`);

			if (!serializedState) {
				throw new Error();
			}

			state = State.fromSerializedData(serializedState);

			await this.storage.delete(`sty.${this.session.state}`);
		} catch {
			const error = new Error('Invalid or missing state');
			this.logging?.error('Validation failed', error);
			throw error;
		}

		const response = await this.sendTokenRequest<Session>(await this.metadata.tokenEndpoint, {
			grant_type: 'authorization_code',
			client_id: this.options.clientId,
			redirect_uri: this.options.redirectUri,
			code_verifier: state.codeVerifier,
			code: this.session.code,
		});

		if (!response.ok) {
			const data = await response.json();
			const error = new Error(`${data.error}: ${data.error_description}`);
			this.logging?.error('Token exchange failed', error);
			throw error;
		}

		Object.assign(this.session, await response.json());

		if (this.session.id_token) {
			this.session.claims = jwt.decode<IdTokenClaims>(this.session.id_token);
		}

		if (this.session.error) {
			const error = new Error(`${this.session.error}: ${this.session.error_description}`);
			this.logging?.error('Validation failed', error);
			throw error;
		}
		if (this.session.scope !== this.options.scopes?.join(' ')) {
			const error = new Error('Invalid scope');
			this.logging?.error('Validation failed', error);
			throw error;
		}
		if (this.session.claims?.nonce !== state.nonce) {
			const error = new Error('Invalid nonce');
			this.logging?.error('Validation failed', error);
			throw error;
		}
		if (this.session.claims?.iss !== (await this.metadata.issuer)) {
			const error = new Error('Invalid iss');
			this.logging?.error('Validation failed', error);
			throw error;
		}
		if (Array.isArray(this.session.claims?.aud) ? this.session.claims?.aud[0] !== this.options.clientId : this.session.claims?.aud !== this.options.clientId) {
			const error = new Error('Invalid aud');
			this.logging?.error('Validation failed', error);
			throw error;
		}

		await this.storage.set(this.options.storageTokenName!, JSON.stringify(this.session));

		if (this.accessToken && this.idTokenClaims) {
			this.dispatchEvent('loggedIn', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);

			if (this.logging) {
				this.logging.xEventId = undefined;
				this.logging.info('Login successful');
			}
		}
	}

	/**
	 * Constructs the authorization URL for initiating the authorization flow.
	 *
	 * @param {ExtraRequestArgs} [params={}] - Additional params to include in the authorization URL.
	 * @returns {Promise<URL>} - A promise that resolves to the constructed authorization URL.
	 *
	 * @throws {Error} Throws an error if metadata retrieval fails.
	 */
	async getAuthorizationUrl(params: ExtraRequestArgs = {}): Promise<URL> {
		const url = new URL(await this.metadata.authorizationEndpoint);

		url.searchParams.append('client_id', this.options.clientId);
		url.searchParams.append('redirect_uri', this.options.redirectUri);
		url.searchParams.append('response_type', this.options.responseType || 'code');
		url.searchParams.append('response_mode', this.options.responseMode || 'fragment');
		url.searchParams.append('scope', this.options.scopes?.join(' ') || '');
		url.searchParams.append('code_challenge_method', 'S256');

		if (params.prompt) {
			url.searchParams.append('prompt', params.prompt);
		}
		if (params.acrValues?.length) {
			url.searchParams.append('acr_values', params.acrValues.join(' '));
		}
		if (params.loginHint?.length) {
			url.searchParams.append('login_hint', params.loginHint);
		}
		if (params.uiLocales?.length) {
			url.searchParams.append('ui_locales', params.uiLocales.join(' '));
		}
		if (params.audiences?.length) {
			url.searchParams.append('audience', params.audiences.join(' '));
		}

		return url;
	}

	protected async waitToInitialize(): Promise<void> {
		await this.#initializationPromise;
	}

	/**
	 * Sends a token request to the specified URL with the given data.
	 *
	 * @param {string} url - The URL to send the request to.
	 * @param {Record<string, string>} [data={}] - The data to include in the request body.
	 * @returns {Promise<HttpClientResponse<T>>} - A promise that resolves to the response from the request.
	 */
	async sendTokenRequest<T>(url: string, data: Record<string, string> = {}): Promise<HttpClientResponse<T>> {
		return this.httpClient.request<T>(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(data).toString(),
		});
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
}
