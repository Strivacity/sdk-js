import type { App } from 'vue';
import type { NativeFlow } from '@strivacity/sdk-core/types';
import type { LoginContext, UseNativeLoginOptions } from '../../src/runtime/types';
import { vi } from 'vitest';
import { createApp } from 'vue';

/**
 * Points the mocked core `initFlow` at the given flow instance. Must be called before dynamically
 * importing a composable that (transitively) calls `initFlow`, and after `vi.resetModules()` -
 * resetting the module registry recreates the `@strivacity/sdk-core` mock (and its `initFlow`
 * mock function) from scratch, so the previous test's `mockReturnValue` no longer applies.
 */
export async function mockInitFlow<T>(flow: T): Promise<void> {
	const core = await import('@strivacity/sdk-core');
	vi.mocked(core.initFlow).mockReturnValue(flow as never);
}

export async function mountWithNativeLogin(flow: NativeFlow, options: UseNativeLoginOptions = {}): Promise<{ app: App; login: LoginContext }> {
	await mockInitFlow(flow);

	const { useNativeLogin } = await import('../../src/runtime/composables/use-native-login');
	let login!: LoginContext;
	const app = createApp({
		setup() {
			login = useNativeLogin(options);

			return () => null;
		},
	});
	app.mount(document.createElement('div'));

	return { app, login };
}
