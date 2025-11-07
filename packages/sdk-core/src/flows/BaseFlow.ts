import type { IdTokenClaims, SDKOptions, SDKStorage, EventFunctions, ExtraRequestArgs, LogoutParams, SDKHttpClient, HttpClientResponse } from '../types';
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

		// eslint-disable-next-line no-async-promise-executor, @typescript-eslint/no-misused-promises
		this.#isAuthenticatedPromise = new Promise(async (resolve) => {
			await this.waitToInitialize();

			try {
				if (this.refreshToken && this.accessTokenExpired) {
					await this.refresh();
				}
			} catch {}

			setTimeout(() => {
				resolve(!this.accessTokenExpired);
				this.#isAuthenticatedPromise = null;
			});
		});

		return this.#isAuthenticatedPromise;
	}

	/**
	 * Constructs a new instance of the `BaseFlow` class.
	 *
	 * @param {Options} options - Configuration options for the flow.
	 * @param {SDKStorage} storage - Storage mechanism for session data.
	 *
	 * @throws {Error} Throws an error if required options are missing or invalid.
	 */
	constructor(options: Options, storage: SDKStorage, httpClient: SDKHttpClient) {
		if (!options.issuer) {
			throw new Error('Missing option: issuer');
		}
		if (!options.clientId) {
			throw new Error('Missing option: clientId');
		}
		if (!options.redirectUri) {
			throw new Error('Missing option: redirectUri');
		}
		if (!options.urlHandler) {
			throw new Error('Missing option: urlHandler');
		}
		if (!options.callbackHandler) {
			throw new Error('Missing option: callbackHandler');
		}
		if (options.scopes && !Array.isArray(options.scopes)) {
			throw new Error('Invalid option: scopes');
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

		if (this.session && this.accessToken && this.idTokenClaims) {
			this.dispatchEvent('sessionLoaded', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
		}

		if (this.accessToken && this.accessTokenExpired) {
			this.dispatchEvent('accessTokenExpired', [{ accessToken: this.accessToken, refreshToken: this.refreshToken }]);
		}
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
	 */
	async logout(params?: URLHandlerParams & LogoutParams): Promise<void> {
		if (typeof this.options.urlHandler !== 'function') {
			throw new Error('URL handler is not defined. Please provide a valid URL handler function in the SDK options.');
		}

		await this.waitToInitialize();

		const session = this.session;

		if (!session?.id_token) {
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

		try {
			await this.options.urlHandler(url.toString(), params as URLHandlerParams);
		} catch {}
	}

	/**
	 * Refreshes the access token using the refresh token.
	 *
	 * @returns {Promise<void>} - A promise that resolves when the token refresh is complete.
	 *
	 * @throws {Error} Throws an error if the refresh fails.
	 */
	async refresh(): Promise<void> {
		await this.waitToInitialize();

		if (typeof this.session?.refresh_token !== 'string') {
			return;
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

			await this.storage.set(this.options.storageTokenName!, JSON.stringify(this.session));

			if (this.accessToken && this.refreshToken && this.idTokenClaims) {
				this.dispatchEvent('tokenRefreshed', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
			}
		} catch {
			this.session = null;
			await this.storage.delete(this.options.storageTokenName!);

			this.dispatchEvent('tokenRefreshFailed', [{ refreshToken: session.refresh_token! }]);
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
			await this.storage.delete(this.options.storageTokenName!);

			if (session?.refresh_token) {
				this.dispatchEvent(success ? 'tokenRevoked' : 'tokenRevokeFailed', [{ token: session.refresh_token, tokenTypeHint: 'refresh_token' }]);
			} else if (session?.access_token) {
				this.dispatchEvent(success ? 'tokenRevoked' : 'tokenRevokeFailed', [{ token: session.access_token, tokenTypeHint: 'access_token' }]);
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

		this.session = new Session();

		Object.assign(this.session, params);

		if (this.session.error) {
			throw new Error(`${this.session.error}: ${this.session.error_description}`);
		}
		if (!this.session.code) {
			throw new Error('Invalid or missing code');
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
			throw new Error('Invalid or missing state');
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

		if (this.session.error) {
			throw new Error(`${this.session.error}: ${this.session.error_description}`);
		}
		if (this.session.scope !== this.options.scopes?.join(' ')) {
			throw new Error('Invalid scope');
		}
		if (this.session.claims?.nonce !== state.nonce) {
			throw new Error('Invalid nonce');
		}
		if (this.session.claims?.iss !== (await this.metadata.issuer)) {
			throw new Error('Invalid iss');
		}
		if (Array.isArray(this.session.claims?.aud) ? this.session.claims?.aud[0] !== this.options.clientId : this.session.claims?.aud !== this.options.clientId) {
			throw new Error('Invalid aud');
		}

		await this.storage.set(this.options.storageTokenName!, JSON.stringify(this.session));

		if (this.accessToken && this.idTokenClaims) {
			this.dispatchEvent('loggedIn', [{ accessToken: this.accessToken, refreshToken: this.refreshToken, claims: this.idTokenClaims }]);
		}
	}

	/**
	 * Constructs the authorization URL for initiating the authorization flow.
	 *
	 * @param {ExtraRequestArgs} [params={}] - Additional params to include in the authorization URL.
	 * @returns {Promise<URL>} - A promise that resolves to the constructed authorization URL.
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
		if (params.acrValues) {
			url.searchParams.append('acr_values', params.acrValues.join(' '));
		}
		if (params.loginHint) {
			url.searchParams.append('login_hint', params.loginHint);
		}
		if (params.uiLocales) {
			url.searchParams.append('ui_locales', params.uiLocales.join(' '));
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
	 * @returns {Promise<HttpClientResponse<Session>>} - A promise that resolves to the response from the request.
	 */
	async sendTokenRequest(url: string, data: Record<string, string> = {}): Promise<HttpClientResponse<Session>> {
		return this.httpClient.request<Session>(url, {
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
