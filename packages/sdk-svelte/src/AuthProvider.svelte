<script lang="ts">
	import type { SDKOptions, IdTokenClaims } from '@strivacity/sdk-core';
	import type { PopupFlow } from '@strivacity/sdk-core/flows/PopupFlow';
	import type { RedirectFlow } from '@strivacity/sdk-core/flows/RedirectFlow';
	import type { NativeFlow } from '@strivacity/sdk-core/flows/NativeFlow';
	import { setContext, onMount } from 'svelte';
	import { initFlow } from '@strivacity/sdk-core';
	import { STRIVACITY_SDK } from './composables';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let { options, children }: { options: SDKOptions; children?: any } = $props();

	// svelte-ignore state_referenced_locally
	const sdk = initFlow(options);
	let state = $state({
		loading: true,
		isAuthenticated: false,
		idTokenClaims: null as IdTokenClaims | null,
		accessToken: null as string | null,
		refreshToken: null as string | null,
		accessTokenExpired: true,
		accessTokenExpirationDate: null as number | null,
	});

	const updateSession = async () => {
		state.isAuthenticated = await sdk.isAuthenticated;
		state.idTokenClaims = sdk.idTokenClaims || null;
		state.accessToken = sdk.accessToken || null;
		state.refreshToken = sdk.refreshToken || null;
		state.accessTokenExpired = sdk.accessTokenExpired;
		state.accessTokenExpirationDate = sdk.accessTokenExpirationDate || null;

		if (state.loading) {
			state.loading = false;
		}
	};
	const events = [
		sdk.subscribeToEvent('init', updateSession),
		sdk.subscribeToEvent('loggedIn', updateSession),
		sdk.subscribeToEvent('sessionLoaded', updateSession),
		sdk.subscribeToEvent('tokenRefreshed', updateSession),
		sdk.subscribeToEvent('tokenRefreshFailed', updateSession),
		sdk.subscribeToEvent('logoutInitiated', updateSession),
		sdk.subscribeToEvent('tokenRevoked', updateSession),
		sdk.subscribeToEvent('tokenRevokeFailed', updateSession),
	];

	setContext(STRIVACITY_SDK, {
		sdk,
		state,

		login: async (options?: Parameters<PopupFlow['login'] | RedirectFlow['login'] | NativeFlow['login']>[0]) => {
			if (sdk.options.mode === 'native') {
				return sdk.login(options);
			}

			await sdk.login(options);
			await updateSession();
		},
		register: async (options?: Parameters<PopupFlow['register'] | RedirectFlow['register'] | NativeFlow['register']>[0]) => {
			if (sdk.options.mode === 'native') {
				return sdk.register(options);
			}

			await sdk.register(options);
			await updateSession();
		},
		entry: async (url?: string) => {
			return await sdk.entry(url);
		},
		refresh: async () => {
			await sdk.refresh();
			await updateSession();
		},
		revoke: async () => {
			await sdk.revoke();
			await updateSession();
		},
		logout: async (options?: Parameters<PopupFlow['logout'] | RedirectFlow['logout']>[0]) => {
			await sdk.logout(options);
			await updateSession();
		},
		handleCallback: async (url?: Parameters<PopupFlow['handleCallback'] | RedirectFlow['handleCallback'] | NativeFlow['handleCallback']>[0]) => {
			await sdk.handleCallback(url);
			await updateSession();
		},
	});

	onMount(() => {
		return () => {
			events.forEach((event) => event.dispose());
		};
	});
</script>

{@render children?.()}
