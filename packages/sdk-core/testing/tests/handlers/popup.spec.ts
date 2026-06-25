import { describe, test, expect, vi, afterEach } from 'vitest';
import { createFakePopup, postMessageFromPopup } from '@strivacity/testing/mocks/window';
import { popupUrlHandler, popupCallbackHandler } from '../../../src/handlers';
import { PopupBlockedError, PopupClosedError } from '../../../src/utils';

describe('popupUrlHandler', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test('should throw a PopupBlockedError when the popup is blocked', async () => {
		vi.spyOn(window, 'open').mockReturnValue(null);

		await expect(popupUrlHandler('https://example.com/')).rejects.toThrow(PopupBlockedError);
	});

	test('should navigate the popup and resolve with the posted message data', async () => {
		const popup = createFakePopup();
		vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

		const promise = popupUrlHandler('https://example.com/');

		postMessageFromPopup(popup, { code: 'abc' });

		await expect(promise).resolves.toEqual({ code: 'abc' });
		expect(popup.location.replace).toHaveBeenCalledWith('https://example.com/');
		expect(popup.focus).toHaveBeenCalled();
		expect(popup.close).toHaveBeenCalled();
	});

	test('should invoke a popup handler function instead of navigating', async () => {
		const popup = createFakePopup();
		vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
		const handler = vi.fn();

		const promise = popupUrlHandler(handler);

		// Let the awaited handler call settle before the internal message listener is registered.
		await Promise.resolve();

		postMessageFromPopup(popup, { code: 'abc' });

		await expect(promise).resolves.toEqual({ code: 'abc' });
		expect(handler).toHaveBeenCalledWith(popup);
		expect(popup.location.replace).not.toHaveBeenCalled();
	});

	test('should ignore messages from an unrelated source', async () => {
		const popup = createFakePopup();
		vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

		const promise = popupUrlHandler('https://example.com/');
		let settled = false;
		void promise.then(() => (settled = true));

		postMessageFromPopup({}, { code: 'wrong' });
		await Promise.resolve();
		expect(settled).toBe(false);

		postMessageFromPopup(popup, { code: 'abc' });
		await expect(promise).resolves.toEqual({ code: 'abc' });
	});

	test('should reject with a PopupClosedError when the popup is closed by the user', async () => {
		vi.useFakeTimers();
		const popup = createFakePopup();
		vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

		const promise = popupUrlHandler('https://example.com/');
		const assertion = expect(promise).rejects.toThrow(PopupClosedError);

		popup.closed = true;
		await vi.advanceTimersByTimeAsync(500);

		await assertion;
	});

	test('cleans up its message listener when the popup is closed by the user, not just the timer', async () => {
		vi.useFakeTimers();
		const popup = createFakePopup();
		vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
		const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

		const promise = popupUrlHandler('https://example.com/');
		promise.catch(() => {});

		popup.closed = true;
		await vi.advanceTimersByTimeAsync(500);
		await expect(promise).rejects.toThrow(PopupClosedError);

		expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
	});

	test('completion-wins race — a redirect message that beats the close-detection tick resolves exactly once, and a late message afterward is a harmless no-op', async () => {
		for (let i = 0; i < 20; i++) {
			vi.useFakeTimers();
			const popup = createFakePopup();
			vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

			const promise = popupUrlHandler('https://example.com/');

			postMessageFromPopup(popup, { code: 'abc' });
			await Promise.resolve();
			popup.closed = true;
			await vi.advanceTimersByTimeAsync(500);

			await expect(promise).resolves.toEqual({ code: 'abc' });

			vi.useRealTimers();
		}
	});

	test('completion-wins race — the close-detection tick beats a redirect message, rejects exactly once, and the late message afterward is a harmless no-op', async () => {
		for (let i = 0; i < 20; i++) {
			vi.useFakeTimers();
			const popup = createFakePopup();
			vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

			const promise = popupUrlHandler('https://example.com/');
			// NOTE: attached immediately so fake-timer microtask flushing below never reports this as an unhandled rejection.
			promise.catch(() => {});

			popup.closed = true;
			await vi.advanceTimersByTimeAsync(500);

			expect(() => postMessageFromPopup(popup, { code: 'abc' })).not.toThrow();
			await expect(promise).rejects.toThrow(PopupClosedError);

			vi.useRealTimers();
		}
	});

	test('should close a leftover popup from a previous call', async () => {
		vi.useFakeTimers();
		const firstPopup = createFakePopup();
		vi.spyOn(window, 'open').mockReturnValueOnce(firstPopup as unknown as Window);

		void popupUrlHandler('https://example.com/first');

		const secondPopup = createFakePopup();
		vi.spyOn(window, 'open').mockReturnValueOnce(secondPopup as unknown as Window);

		const secondPromise = popupUrlHandler('https://example.com/second');

		expect(firstPopup.close).toHaveBeenCalled();

		postMessageFromPopup(secondPopup, { code: 'abc' });

		await expect(secondPromise).resolves.toEqual({ code: 'abc' });
	});
});

describe('popupCallbackHandler', () => {
	afterEach(() => {
		globalThis.location.href = 'https://example.com/';
	});

	test('should post parsed query parameters to the opener window', () => {
		const postMessage = vi.fn();
		vi.spyOn(window, 'opener', 'get').mockReturnValue({ postMessage });
		globalThis.location.href = 'https://example.com/callback?code=abc&state=xyz';

		void popupCallbackHandler();

		expect(postMessage).toHaveBeenCalledWith({ code: 'abc', state: 'xyz' }, '*');
	});

	test('should parse parameters from the fragment when responseMode is "fragment"', () => {
		const postMessage = vi.fn();
		vi.spyOn(window, 'opener', 'get').mockReturnValue({ postMessage });
		globalThis.location.href = 'https://example.com/callback#code=abc&state=xyz';

		void popupCallbackHandler(undefined, 'fragment');

		expect(postMessage).toHaveBeenCalledWith({ code: 'abc', state: 'xyz' }, '*');
	});

	test('should post an invalid_request error when a parameter is duplicated', () => {
		const postMessage = vi.fn();
		vi.spyOn(window, 'opener', 'get').mockReturnValue({ postMessage });
		globalThis.location.href = 'https://example.com/callback?code=abc&code=def';

		void popupCallbackHandler();

		expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ error: 'invalid_request' }), '*');
	});

	test('should do nothing when there is no opener window', () => {
		vi.spyOn(window, 'opener', 'get').mockReturnValue(null);
		globalThis.location.href = 'https://example.com/callback?code=abc';

		expect(() => void popupCallbackHandler()).not.toThrow();
	});

	test('should return a promise that never settles', async () => {
		vi.spyOn(window, 'opener', 'get').mockReturnValue(null);

		let settled = false;
		void popupCallbackHandler().then(() => (settled = true));

		await Promise.resolve();
		await Promise.resolve();

		expect(settled).toBe(false);
	});
});
