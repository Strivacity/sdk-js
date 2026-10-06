import type { NativeFlow, NativeFlowState } from '../../../src/types';
import { describe, test, expect, vi } from 'vitest';
import { createNativeLoginController } from '../../../src/utils/native-login';
import { FallbackError } from '../../../src/utils/errors';
import { timestamp } from '../../../src/utils/common';

const loginScreen: Partial<NativeFlowState> = {
	hostedUrl: 'https://brandtegrity.io/hosted',
	screen: 'identification',
	forms: [{ id: 'identifier', type: 'form', widgets: [] }],
	messages: {},
};

function createSdk(overrides: Partial<Record<keyof NativeFlow, unknown>> = {}) {
	return {
		session: null,
		logging: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
		init: vi.fn().mockResolvedValue(undefined),
		startSession: vi.fn().mockResolvedValue(loginScreen),
		submitForm: vi.fn().mockResolvedValue(loginScreen),
		...overrides,
	} as unknown as NativeFlow;
}

function sdkGetter(overrides: Partial<Record<keyof NativeFlow, unknown>> = {}) {
	const sdk = createSdk(overrides);

	return () => sdk;
}

describe('createNativeLoginController', () => {
	test('starts loading with an empty snapshot', () => {
		const controller = createNativeLoginController(sdkGetter());

		expect(controller.getSnapshot()).toEqual({ loading: true, forms: {}, messages: {}, state: {} });
	});

	test('start initializes the sdk, starts a session with options.params and publishes the new screen', async () => {
		const sdk = createSdk();
		const controller = createNativeLoginController(() => sdk, { params: { loginHint: 'user' } });
		const listener = vi.fn();
		controller.subscribe(listener);

		await controller.start();

		expect(sdk.init).toHaveBeenCalled();
		expect(sdk.startSession).toHaveBeenCalledWith({ loginHint: 'user' });
		expect(controller.getSnapshot()).toEqual({
			loading: false,
			forms: { identifier: {} },
			messages: { identifier: {} },
			state: { ...loginScreen, finalizeUrl: undefined, layout: undefined, branding: undefined },
		});
		expect(listener).toHaveBeenLastCalledWith(controller.getSnapshot());
	});

	test('start reports an init failure to onError and stops loading', async () => {
		const error = new Error('init failed');
		const sdk = createSdk({ init: vi.fn().mockRejectedValue(error) });
		const onError = vi.fn();
		const controller = createNativeLoginController(() => sdk, { onError });

		await controller.start();

		expect(onError).toHaveBeenCalledWith(error);
		expect(sdk.startSession).not.toHaveBeenCalled();
		expect(controller.getSnapshot().loading).toBe(false);
	});

	test('publishes immutable snapshots and stops notifying after unsubscribe', () => {
		const controller = createNativeLoginController(sdkGetter());
		const listener = vi.fn();
		const unsubscribe = controller.subscribe(listener);
		const before = controller.getSnapshot();

		controller.setFormValue('identifier', 'email', 'a@b.c');

		expect(controller.getSnapshot()).not.toBe(before);
		expect(before.forms).toEqual({});
		expect(listener).toHaveBeenCalledTimes(1);

		unsubscribe();
		controller.setFormValue('identifier', 'email', 'x@y.z');

		expect(listener).toHaveBeenCalledTimes(1);
	});

	test('setFormValue stores empty strings as null and submitForm sends the unflattened values', async () => {
		const sdk = createSdk();
		const controller = createNativeLoginController(() => sdk);

		controller.setFormValue('identifier', 'user.email', 'a@b.c');
		controller.setFormValue('identifier', 'user.name', '');
		await controller.submitForm('identifier');

		expect(sdk.submitForm).toHaveBeenCalledWith('identifier', { user: { email: 'a@b.c', name: null } });
	});

	test('submitForm prefers a custom body', async () => {
		const sdk = createSdk();
		const controller = createNativeLoginController(() => sdk);

		controller.setFormValue('identifier', 'email', 'a@b.c');
		await controller.submitForm('identifier', { custom: true });

		expect(sdk.submitForm).toHaveBeenCalledWith('identifier', { custom: true });
	});

	test('keeps form values on the same screen and routes messages', async () => {
		const onGlobalMessage = vi.fn();
		const sdk = createSdk();
		const controller = createNativeLoginController(() => sdk, { onGlobalMessage });

		await controller.start();
		controller.setFormValue('identifier', 'email', 'a@b.c');
		vi.mocked(sdk.submitForm).mockResolvedValue({
			messages: {
				global: { type: 'error', text: 'Oops' },
				identifier: { email: { type: 'error', text: 'Invalid' } },
			} as unknown as NativeFlowState['messages'],
		});
		await controller.submitForm('identifier');

		expect(onGlobalMessage).toHaveBeenCalledWith({ type: 'error', text: 'Oops' });
		expect(controller.getSnapshot().forms).toEqual({ identifier: { email: 'a@b.c' } });
		expect(controller.getSnapshot().messages).toEqual({ identifier: { email: { type: 'error', text: 'Invalid' } } });
		expect(controller.getSnapshot().state.screen).toBe('identification');
	});

	test('keeps loading while a finalizeUrl is pending', async () => {
		const controller = createNativeLoginController(sdkGetter({ startSession: vi.fn().mockResolvedValue({ ...loginScreen, finalizeUrl: 'https://f' }) }));

		await controller.start();

		expect(controller.getSnapshot().loading).toBe(true);
	});

	test('calls onLogin when the sdk has a valid session, without touching the state', async () => {
		const session = { access_token: 'at', expires_at: timestamp() + 3600 };
		const onLogin = vi.fn();
		const controller = createNativeLoginController(sdkGetter({ session }), { onLogin });

		await controller.start();

		expect(onLogin).toHaveBeenCalledWith(session);
		expect(controller.getSnapshot().state).toEqual({});
	});

	test('routes FallbackError to onFallback and other errors to onError, keeping loading set', async () => {
		const fallback = new FallbackError(new URL('https://brandtegrity.io/hosted'));
		const failure = new Error('boom');
		const onFallback = vi.fn();
		const onError = vi.fn();
		const sdk = createSdk({ startSession: vi.fn().mockRejectedValue(fallback), submitForm: vi.fn().mockRejectedValue(failure) });
		const controller = createNativeLoginController(() => sdk, { onFallback, onError });

		await controller.start();
		await controller.submitForm('identifier');

		expect(onFallback).toHaveBeenCalledWith(fallback);
		expect(onError).toHaveBeenCalledWith(failure);
		expect(controller.getSnapshot().loading).toBe(true);
	});

	test('triggerFallback throws without a hosted URL, otherwise calls onFallback', async () => {
		const onFallback = vi.fn();
		const controller = createNativeLoginController(sdkGetter(), { onFallback });

		expect(() => controller.triggerFallback()).toThrow('No hosted URL provided');

		await controller.start();
		controller.triggerFallback('nope');

		expect(onFallback).toHaveBeenCalledWith(expect.any(FallbackError));
		expect(onFallback.mock.calls[0][0].url.href).toBe('https://brandtegrity.io/hosted');
	});

	test('setOptions replaces the callbacks used afterwards', () => {
		const first = vi.fn();
		const second = vi.fn();
		const controller = createNativeLoginController(sdkGetter(), { onClose: first });

		controller.setOptions({ onClose: second });
		controller.triggerClose();

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalled();
	});

	test('setMessage merges into the form bucket', () => {
		const controller = createNativeLoginController(sdkGetter());

		controller.setMessage('identifier', 'email', { type: 'error', text: 'Invalid' });

		expect(controller.getSnapshot().messages).toEqual({ identifier: { email: { type: 'error', text: 'Invalid' } } });
	});

	test('resolves a lazy sdk getter on every use', async () => {
		const sdk = createSdk();
		const getter = vi.fn(() => sdk);
		const controller = createNativeLoginController(getter);

		expect(getter).not.toHaveBeenCalled();

		await controller.start();

		expect(getter).toHaveBeenCalled();
		expect(sdk.startSession).toHaveBeenCalledWith({});
	});
});
