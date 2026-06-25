import type { EntryResponse, ExtraRequestArgs, SDK } from './oidc';

export declare class LanguageSelectorComponent extends HTMLElement {}

export declare class NotificationComponent extends HTMLElement {
	devMode: boolean;
}

export declare class LandingComponent extends HTMLElement {
	activeBlock: string;
	baseUrl: string;
	lazy: boolean;
	lang: string;
	debug: boolean;
	initialized?: boolean;
}

export declare class LoginComponent extends HTMLElement {
	mode?: string;
	baseUrl?: string;
	sessionId?: string;
	shortAppId?: string;
	lazy: boolean;
	params: ExtraRequestArgs;
	lang: string;
	debug: boolean;
	initialized?: boolean;
}

export type EmbeddedParams = ExtraRequestArgs & { language?: string };

export type EmbeddedLoginFlow = {
	/**
	 * The session ID of the current embedded login flow, or `null` if no session has been started.
	 *
	 * @type {string | null}
	 * @deprecated Use `sdk.sessionId` instead of accessing this via the login flow instance.
	 */
	sessionId: string | null;

	/**
	 * The short application ID associated with the current embedded login flow, or `null` if not yet available.
	 *
	 * @type {string | null}
	 * @deprecated Use `sdk.shortAppId` instead of accessing this via the login flow instance.
	 */
	shortAppId: string | null;

	/**
	 * The language code used for the embedded login flow UI.
	 *
	 * @type {string}
	 * @deprecated Use `sdk.language` instead of accessing this via the login flow instance.
	 */
	language: string;

	/**
	 * Starts the embedded login session.
	 *
	 * @returns {Promise<void>}
	 * @deprecated Use `sdk.startSession()` instead of calling this via the login flow instance.
	 */
	startSession(): Promise<void>;

	/**
	 * Finalizes the embedded login session by processing the callback URL.
	 *
	 * @param {string | URL} url - The callback URL returned after authentication.
	 * @returns {Promise<void>}
	 * @deprecated Use `sdk.finalizeSession()` instead of calling this via the login flow instance.
	 */
	finalizeSession(url: string | URL): Promise<void>;
};

export type EmbeddedFlow = Omit<SDK<EmbeddedParams, Promise<EntryResponse>>, 'login' | 'register'> & {
	/**
	 * Starts the embedded authentication session with the given parameters.
	 *
	 * @param {EmbeddedParams} loginParams - The parameters to use when starting the session.
	 * @returns {Promise<void>}
	 */
	startSession(loginParams: EmbeddedParams): Promise<void>;

	/**
	 * Finalizes the embedded authentication session by processing the callback URL.
	 *
	 * @param {string | URL} url - The callback URL returned after authentication.
	 * @returns {Promise<void>}
	 */
	finalizeSession(url: string | URL): Promise<void>;

	/**
	 * Initiates the embedded login flow and returns an `EmbeddedLoginFlow` instance to drive the process.
	 *
	 * @param {EmbeddedParams} [params] - Optional parameters for the login request.
	 * @returns {EmbeddedLoginFlow} Embedded login flow instance to drive the process.
	 */
	login(params?: EmbeddedParams): EmbeddedLoginFlow;

	/**
	 * Initiates the embedded registration flow and returns an `EmbeddedLoginFlow` instance to drive the process.
	 *
	 * @param {EmbeddedParams} [params] - Optional parameters for the registration request.
	 * @returns {EmbeddedLoginFlow} Embedded login flow instance to drive the process.
	 */
	register(params?: EmbeddedParams): EmbeddedLoginFlow;
};
