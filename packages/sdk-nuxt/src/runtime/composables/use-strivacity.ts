import type { EmbeddedFlow, IdTokenClaims, NativeFlow, PopupFlow, RedirectFlow, SessionData } from '@strivacity/sdk-core/types';
import type { SDKContext } from '../types';
import { computed, ref } from 'vue';
import { initFlow } from '@strivacity/sdk-core';
import { isSessionExpired } from '@strivacity/sdk-core/utils';
import { tryUseNuxtApp, useRuntimeConfig } from '#app';
import { useSession } from './use-session';
import createLogging from '#strivacity-options-logging';
import createHttpClient from '#strivacity-options-httpClient';

type Flow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow;

// Browser-only singleton: there is exactly one user per page there. It is never created during SSR, where a module-level
// instance would be shared by every concurrent request (and leak one user's session into another user's HTML).
let clientContext: SDKContext<Flow> | undefined;

/**
 * Derives the reactive state from a session. Used by the SSR context, and as the browser's initial state, so the first client
 * render matches the server-rendered HTML (no hydration mismatch) until the browser SDK takes over.
 *
 * @param {SessionData | undefined} session - The current session (`useSession()`).
 * @param {boolean} serverManaged - Whether server-managed sessions are enabled (`serverSessionUri`).
 * @returns The derived state values.
 */
function deriveState(session: SessionData | undefined, serverManaged: boolean) {
	return {
		// With client-managed sessions the server cannot know the session (it lives in browser storage), so stay "loading"
		// until the browser SDK has loaded it.
		loading: !serverManaged,
		language: 'en-US',
		isAuthenticated: serverManaged && !isSessionExpired(session),
		idTokenClaims: session?.claims ?? null,
		accessToken: session?.access_token ?? null,
		accessTokenExpired: isSessionExpired(session),
		accessTokenExpirationDate: session?.expires_at ?? null,
	};
}

/**
 * Creates the browser SDK instance and its reactive state. Called once, by the `strivacity` client plugin (or lazily by
 * the first `useStrivacity()` call in the browser).
 *
 * @returns {SDKContext} The browser SDK context.
 */
export function getClientContext(): SDKContext<Flow> {
	if (clientContext) {
		return clientContext;
	}

	const options = useRuntimeConfig().public.strivacity;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const sdk: any = initFlow({
		...options,
		logging: createLogging ? createLogging() : undefined,
		httpClient: createHttpClient ? createHttpClient() : undefined,
	});

	// Start from the same values the server rendered with, then let the SDK update them.
	const initial = deriveState(useSession().value, !!options.serverSessionUri);
	const loading = ref<boolean>(initial.loading);
	const language = ref<string>(initial.language);
	const isAuthenticated = ref<boolean>(initial.isAuthenticated);
	const idTokenClaims = ref<IdTokenClaims | null>(initial.idTokenClaims);
	const accessToken = ref<string | null>(initial.accessToken);
	const refreshToken = ref<string | null>(null);
	const accessTokenExpired = ref<boolean>(initial.accessTokenExpired);
	const accessTokenExpirationDate = ref<number | null>(initial.accessTokenExpirationDate);

	const updateSession = async () => {
		const authenticated = await sdk.isAuthenticated;

		if (loading.value) {
			loading.value = false;
		}
		if (sdk.language !== language.value) {
			language.value = sdk.language;
		}
		if (authenticated !== isAuthenticated.value) {
			isAuthenticated.value = authenticated;
		}
		if (sdk.idTokenClaims !== idTokenClaims.value) {
			idTokenClaims.value = sdk.idTokenClaims || null;
		}
		if (sdk.accessToken !== accessToken.value) {
			accessToken.value = sdk.accessToken || null;
		}
		if (sdk.refreshToken !== refreshToken.value) {
			refreshToken.value = sdk.refreshToken || null;
		}
		if (sdk.accessTokenExpired !== accessTokenExpired.value) {
			accessTokenExpired.value = sdk.accessTokenExpired;
		}
		if (sdk.accessTokenExpirationDate !== accessTokenExpirationDate.value) {
			accessTokenExpirationDate.value = sdk.accessTokenExpirationDate || null;
		}
	};

	sdk.subscribeToAllEvents(updateSession);
	sdk.session = useSession().value;
	void updateSession();

	clientContext = {
		sdk,
		loading,
		language,
		isAuthenticated,
		idTokenClaims,
		accessToken,
		refreshToken,
		accessTokenExpired,
		accessTokenExpirationDate,
		init: () => sdk.init(),
		subscribeToEvent: ((...args: Parameters<typeof sdk.subscribeToEvent>) => sdk.subscribeToEvent(...args)) as typeof sdk.subscribeToEvent,
		subscribeToAllEvents: (...args: Parameters<typeof sdk.subscribeToAllEvents>) => sdk.subscribeToAllEvents(...args),
		checkAuthentication: (...args: Parameters<typeof sdk.checkAuthentication>) => sdk.checkAuthentication(...args),
		tokenExchange: (...args: Parameters<typeof sdk.tokenExchange>) => sdk.tokenExchange(...args),
		handleCallback: (...args: Parameters<typeof sdk.handleCallback>) => sdk.handleCallback(...args),
		refresh: (...args: Parameters<typeof sdk.refresh>) => sdk.refresh(...args),
		revoke: () => sdk.revoke(),
		logout: (...args: Parameters<typeof sdk.logout>) => sdk.logout(...args),
		login: (...args: Parameters<typeof sdk.login>) => sdk.login(...args),
		register: (...args: Parameters<typeof sdk.register>) => sdk.register(...args),
		entry: (...args: Parameters<typeof sdk.entry>) => sdk.entry(...args),
	};

	return clientContext;
}

const SDK_METHODS = new Set([
	'init',
	'login',
	'register',
	'entry',
	'handleCallback',
	'tokenExchange',
	'refresh',
	'revoke',
	'logout',
	'updateSession',
	'cleanupSession',
	'startSession',
	'submitForm',
	'finalizeSession',
]);

function browserOnly(name: string): () => never {
	return () => {
		throw new Error(`[@strivacity/sdk-nuxt] ${name}() is only available in the browser. During SSR, useStrivacity() is read-only.`);
	};
}

/**
 * Builds a read-only context for server-side rendering from the current request's session (`useSession()`, filled by the
 * module's server middleware when server-managed sessions are enabled). No SDK instance is created on the server.
 *
 * @returns {SDKContext} The read-only SSR context.
 */
function createServerContext(): SDKContext<Flow> {
	const options = useRuntimeConfig().public.strivacity;
	const session = useSession();
	const serverManaged = !!options.serverSessionUri;

	const state = computed(() => deriveState(session.value, serverManaged));
	const isAuthenticated = computed(() => state.value.isAuthenticated);
	const idTokenClaims = computed(() => state.value.idTokenClaims);
	const accessToken = computed(() => state.value.accessToken);
	const accessTokenExpired = computed(() => state.value.accessTokenExpired);
	const accessTokenExpirationDate = computed(() => state.value.accessTokenExpirationDate);
	const noopSubscription = () => ({ dispose: () => undefined });

	const values: Record<string, () => unknown> = {
		options: () => options,
		session: () => session.value ?? null,
		isAuthenticated: async () => Promise.resolve(isAuthenticated.value),
		isAuthenticatedSync: () => isAuthenticated.value,
		idTokenClaims: () => idTokenClaims.value,
		accessToken: () => accessToken.value,
		accessTokenExpired: () => accessTokenExpired.value,
		accessTokenExpirationDate: () => accessTokenExpirationDate.value,
		subscribeToEvent: () => noopSubscription,
		subscribeToAllEvents: () => noopSubscription,
		checkAuthentication: () => async () => Promise.resolve(isAuthenticated.value),
	};

	const sdk = new Proxy(
		{},
		{
			get(_target, property) {
				if (typeof property !== 'string') {
					return undefined;
				}
				if (property in values) {
					return values[property]!();
				}
				if (SDK_METHODS.has(property)) {
					return browserOnly(`sdk.${property}`);
				}

				return undefined;
			},
		},
	) as Flow;

	return {
		sdk,
		loading: ref<boolean>(state.value.loading),
		language: ref<string>(state.value.language),
		isAuthenticated,
		idTokenClaims,
		accessToken,
		refreshToken: ref<string | null>(null),
		accessTokenExpired,
		accessTokenExpirationDate,
		init: async () => Promise.resolve(),
		subscribeToEvent: noopSubscription,
		subscribeToAllEvents: noopSubscription,
		checkAuthentication: async () => Promise.resolve(isAuthenticated.value),
		tokenExchange: browserOnly('tokenExchange'),
		handleCallback: browserOnly('handleCallback'),
		refresh: browserOnly('refresh'),
		revoke: browserOnly('revoke'),
		logout: browserOnly('logout'),
		login: browserOnly('login'),
		register: browserOnly('register'),
		entry: browserOnly('entry'),
	};
}

/**
 * A composable to access the Strivacity SDK context.
 *
 * In the browser it returns the live SDK instance and its reactive state. During server-side rendering it returns a
 * read-only context derived from the current request's session: the refs and `sdk.options` / `sdk.session` can be read,
 * while SDK methods such as `login()` throw, because authentication flows only run in the browser.
 *
 * @template T - The type of the Strivacity SDK flow (RedirectFlow, PopupFlow, NativeFlow, or EmbeddedFlow).
 * @returns {SDKContext<T>} The Strivacity SDK context.
 */
export const useStrivacity = <T extends Flow = Flow>(): SDKContext<T> => {
	if (import.meta.server || tryUseNuxtApp()?.ssrContext) {
		return createServerContext() as unknown as SDKContext<T>;
	}

	return getClientContext() as unknown as SDKContext<T>;
};
