import type {
	SDKContext,
	LoginContext,
	UseNativeLoginOptions,
	RedirectFlow,
	PopupFlow,
	NativeFlow,
	EmbeddedFlow,
	StyAuthProviderProps,
	SessionData,
} from '../../src/types';
import { mount as svelteMount, unmount as svelteUnmount, flushSync, tick } from 'svelte';
import { flushPromises } from '@strivacity/testing/mocks/common';
import Harness from '../fixtures/Harness.svelte';
import StrivacityConsumer from '../fixtures/StrivacityConsumer.svelte';
import NativeLoginConsumer from '../fixtures/NativeLoginConsumer.svelte';
import NativeLoginContextConsumer from '../fixtures/NativeLoginContextConsumer.svelte';
import AuthProviderHost from '../fixtures/AuthProviderHost.svelte';

type Flow = RedirectFlow | PopupFlow | NativeFlow | EmbeddedFlow;

// mount()/unmount() from 'svelte' are the only entry point runes-using code (onMount/onDestroy/setContext/getContext
// included) can be exercised through outside of a real component tree; every helper below wraps a small fixture
// component (tests/fixtures/*.svelte) through them instead of calling the hooks directly from a .spec.ts file.
async function settle() {
	await flushPromises();
	flushSync();
	await tick();
}

export function mountStrivacityConsumerWithoutProvider() {
	const target = document.createElement('div');
	const instance = svelteMount(StrivacityConsumer, { target }) as { getContextValue: () => SDKContext<Flow> };

	return { target, instance };
}

export async function mountStrivacityConsumer(context: SDKContext<Flow>) {
	const target = document.createElement('div');
	const harness = svelteMount(Harness, { target, props: { context, component: StrivacityConsumer } }) as {
		getInstance: () => { getContextValue: () => SDKContext<Flow> };
	};
	await settle();

	return { target, harness, instance: harness.getInstance() };
}

export function mountNativeLoginContextConsumerWithoutProvider() {
	const target = document.createElement('div');
	const instance = svelteMount(NativeLoginContextConsumer, { target }) as { getContextValue: () => LoginContext };

	return { target, instance };
}

export async function mountWithNativeLogin(sdk: NativeFlow, options: UseNativeLoginOptions = {}) {
	const target = document.createElement('div');
	// unlike sdk-vue (which destructures `sdk` out of the context and calls sdk.init() directly), useNativeLogin here
	// keeps the whole SDKContext and calls its own ctx.init() wrapper, so the mock context needs an init() of its own.
	const context = { sdk, init: () => sdk.init() } as unknown as SDKContext<NativeFlow>;
	const harness = svelteMount(Harness, { target, props: { context, component: NativeLoginConsumer, componentProps: { options } } }) as {
		getInstance: () => { getLogin: () => LoginContext; getChildContext: () => LoginContext | undefined };
	};
	await settle();

	const instance = harness.getInstance();

	return { target, harness, login: instance.getLogin(), getChildContext: () => instance.getChildContext() };
}

export async function mountAuthProvider(options: StyAuthProviderProps['options'], initialSession: SessionData | null = null) {
	const target = document.createElement('div');
	const instance = svelteMount(AuthProviderHost, { target, props: { options, initialSession } }) as {
		getContextValue: () => SDKContext<Flow>;
		getChildContextValue: () => SDKContext<Flow> | undefined;
		setSession: (value: SessionData | null | undefined) => void;
	};
	await settle();

	return { target, instance };
}

export const unmount = svelteUnmount;
export { settle };
