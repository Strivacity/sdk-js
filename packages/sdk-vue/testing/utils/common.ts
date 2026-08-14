import type { SDKContext, LoginContext, UseNativeLoginOptions, RedirectFlow, NativeFlow } from '../../src/types';
import { vi } from 'vitest';
import { createApp, inject, type App } from 'vue';
import { initFlow } from '@strivacity/sdk-core';
import { STRIVACITY_SDK, useNativeLogin } from '../../src/composables';
import { createStrivacitySDK } from '../../src/plugin';

export function mount(sdk: unknown, setup: () => void) {
	const app = createApp({
		setup() {
			setup();
			return () => null;
		},
	});
	app.provide(STRIVACITY_SDK, { sdk });
	app.mount(document.createElement('div'));

	return app;
}

export function install(flow: RedirectFlow): { app: App; context: SDKContext<RedirectFlow> } {
	vi.mocked(initFlow).mockReturnValue(flow as never);

	let context: SDKContext<RedirectFlow> | undefined;
	const app = createApp({
		setup() {
			context = inject<SDKContext<RedirectFlow>>(STRIVACITY_SDK);

			return () => null;
		},
	});

	app.use(
		createStrivacitySDK({
			mode: 'redirect',
			issuer: 'https://brandtegrity.io',
			clientId: 'client-id',
			redirectUri: 'https://brandtegrity.io/callback',
		}),
	);
	app.mount(document.createElement('div'));

	return { app, context: context! };
}

export function mountWithNativeLogin(sdk: NativeFlow, options: UseNativeLoginOptions = {}) {
	let login!: LoginContext;
	const app = mount(sdk, () => {
		login = useNativeLogin(options);
	});

	return { app, login };
}
