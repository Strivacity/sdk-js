import type { EntryResponse, ExtraRequestArgs, SDK } from './oidc';

export declare class LanguageSelectorComponent extends HTMLElement {}

export declare class NotificationComponent extends HTMLElement {}

export declare class LandingComponent extends HTMLElement {
	activeBlock: string;
	baseUrl: string;
	lazy: boolean;
	lang: string;
	debug: boolean;
	initialized?: boolean;
}

export declare class LoginComponent extends HTMLElement {
	mode: string;
	baseUrl: string;
	sessionId?: string | null;
	shortAppId?: string | null;
	lazy: boolean;
	params: EmbeddedParams;
	lang: string;
	debug: boolean;
	initialized?: boolean;
	start(params?: EmbeddedParams): Promise<void>;
	updatePageTitle(data?: string | { text: string; values: Record<string, unknown> }): void;
}

export type EmbeddedParams = ExtraRequestArgs & { language?: string };

export type EmbeddedLoginFlow = {
	/**
	 * The session ID of the current embedded login flow, or `null` if no session has been started.
	 *
	 * @deprecated Use `sdk.sessionId` instead of accessing this via the login flow instance.
	 */
	sessionId: string | null;

	/**
	 * The short application ID associated with the current embedded login flow, or `null` if not yet available.
	 *
	 * @deprecated Use `sdk.shortAppId` instead of accessing this via the login flow instance.
	 */
	shortAppId: string | null;

	/**
	 * The language code used for the embedded login flow UI.
	 *
	 * @deprecated Use `sdk.language` instead of accessing this via the login flow instance.
	 */
	language: string;

	/**
	 * Starts the embedded login session.
	 *
	 * @deprecated Use `sdk.startSession()` instead of calling this via the login flow instance.
	 *
	 * @returns {Promise<void>}
	 */
	startSession(): Promise<void>;

	/**
	 * Finalizes the embedded login session by processing the callback URL.
	 *
	 * @deprecated Use `sdk.finalizeSession()` instead of calling this via the login flow instance.
	 *
	 * @param {string | URL} url - The callback URL returned after authentication.
	 * @returns {Promise<void>}
	 */
	finalizeSession(url: string | URL): Promise<void>;
};

export type EmbeddedFlow = Omit<SDK<EmbeddedParams, Promise<EntryResponse>>, 'login' | 'register'> & {
	/**
	 * Starts the embedded authentication session with the given parameters.
	 *
	 * @param {EmbeddedParams} params - The parameters to use when starting the session.
	 * @returns {Promise<void>}
	 */
	startSession(params?: EmbeddedParams): Promise<void>;

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
	 * @deprecated Use `startSession` and `finalizeSession` directly instead.
	 *
	 * @param {EmbeddedParams} [params] - Optional parameters for the login request.
	 * @returns {EmbeddedLoginFlow} Embedded login flow instance to drive the process.
	 */
	login(params?: EmbeddedParams): EmbeddedLoginFlow;

	/**
	 * Initiates the embedded registration flow and returns an `EmbeddedLoginFlow` instance to drive the process.
	 *
	 * @deprecated Use `startSession` and `finalizeSession` directly instead.
	 *
	 * @param {EmbeddedParams} [params] - Optional parameters for the registration request.
	 * @returns {EmbeddedLoginFlow} Embedded login flow instance to drive the process.
	 */
	register(params?: EmbeddedParams): EmbeddedLoginFlow;
};
