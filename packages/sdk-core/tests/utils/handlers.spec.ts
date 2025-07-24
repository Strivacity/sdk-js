import { vi, describe, test, expect } from 'vitest';
import { redirectUrlHandler, redirectCallbackHandler, popupUrlHandler, popupCallbackHandler } from '../../src/utils/handlers';

describe('redirectUrlHandler', () => {
	['self', 'top'].forEach((targetWindow) =>
		test(`targetWindow: ${targetWindow}`, async () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const locationMethodSpy = vi.spyOn(window[targetWindow as any].location, 'assign').mockImplementation(() => {});
			const url = 'https://brandtegrity.io';

			void redirectUrlHandler(url, { targetWindow: targetWindow as 'self' | 'top' });

			await vi.waitFor(() => expect(locationMethodSpy).toHaveBeenCalledWith(url));
		}),
	);

	['assign', 'replace'].forEach((locationMethod) =>
		test(`locationMethod: ${locationMethod}`, async () => {
			const locationMethodSpy = vi.spyOn(window.self.location, locationMethod as 'assign' | 'replace').mockImplementation(() => {});
			const url = 'https://brandtegrity.io';

			void redirectUrlHandler(url, { locationMethod: locationMethod as 'assign' | 'replace' });

			await vi.waitFor(() => expect(locationMethodSpy).toHaveBeenCalledWith(url));
		}),
	);
});

describe('redirectCallbackHandler', () => {
	test('responseMode: query', async () => {
		expect(await redirectCallbackHandler('https://brandtegrity.io?test=value#unused=fragment', 'query')).toEqual({ test: 'value' });
	});

	test('responseMode: fragment', async () => {
		expect(await redirectCallbackHandler('https://brandtegrity.io?unused=query#test=value', 'fragment')).toEqual({ test: 'value' });
	});
});

describe('popupUrlHandler', () => {
	const url = 'https://brandtegrity.io';

	test('should open correctly', async () => {
		const popupWindow = {
			closed: false,
			close: vi.fn(),
			focus: vi.fn(),
			location: { replace: vi.fn() },
		};
		// @ts-expect-error: Override window.open
		const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => {
			setTimeout(() => {
				window.dispatchEvent(
					// @ts-expect-error: Override event.source
					new MessageEvent('message', { source: popupWindow, origin: window.location.origin, data: { test: 'value' } }),
				);
			});

			return popupWindow;
		});

		await popupUrlHandler(url);
		expect(windowOpenSpy).toHaveBeenCalledWith(undefined, '_blank', expect.stringMatching(/\w+/));
		expect(popupWindow.focus).toHaveBeenCalled();
		expect(popupWindow.location.replace).toHaveBeenCalled();
		expect(popupWindow.close).toHaveBeenCalled();
	});

	test('should set popup window target correctly', async () => {
		const popupWindow = {
			closed: false,
			close: vi.fn(),
			focus: vi.fn(),
			location: { replace: vi.fn() },
		};
		// @ts-expect-error: Override window.open
		const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => {
			setTimeout(() => {
				window.dispatchEvent(
					// @ts-expect-error: Override event.source
					new MessageEvent('message', { source: popupWindow, origin: window.location.origin, data: { test: 'value' } }),
				);
			});

			return popupWindow;
		});

		await popupUrlHandler(url, { popupWindowTarget: 'custom' });
		expect(windowOpenSpy).toHaveBeenCalledWith(undefined, 'custom', expect.stringMatching(/\w+/));
	});

	test('should set additional popup window features correctly', async () => {
		const popupWindow = {
			closed: false,
			close: vi.fn(),
			focus: vi.fn(),
			location: { replace: vi.fn() },
		};
		// @ts-expect-error: Override window.open
		const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => {
			setTimeout(() => {
				window.dispatchEvent(
					// @ts-expect-error: Override event.source
					new MessageEvent('message', { source: popupWindow, origin: window.location.origin, data: { test: 'value' } }),
				);
			});

			return popupWindow;
		});

		await popupUrlHandler(url, { popupWindowFeatures: { height: 600, test: 'value', width: 800 } });
		expect(windowOpenSpy).toHaveBeenCalledWith(undefined, '_blank', expect.stringMatching(/height=600,test=value,width=800/));
	});

	test('should handle close by user correctly', async () => {
		const popupWindow = {
			closed: false,
			close: vi.fn(),
			focus: vi.fn(),
			location: { replace: vi.fn() },
		};
		// @ts-expect-error: Override window.open
		const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => {
			setTimeout(() => {
				popupWindow.closed = true;
			});

			return popupWindow;
		});

		await expect(() => popupUrlHandler(url)).rejects.toThrowError('Popup closed by user');
		expect(windowOpenSpy).toHaveBeenCalledWith(undefined, '_blank', expect.stringMatching(/\w+/));
		expect(popupWindow.focus).toHaveBeenCalled();
		expect(popupWindow.location.replace).toHaveBeenCalled();
	});

	test('should handle popup blocking correctly', async () => {
		// @ts-expect-error: Override window.open
		vi.spyOn(window, 'open').mockImplementation(() => {});

		await expect(() => popupUrlHandler(url)).rejects.toThrowError('Popup window blocked');
	});
});

describe('popupCallbackHandler', () => {
	test('responseMode: query', async () => {
		const postMessageSpy = vi.fn().mockImplementation(() => {});

		// @ts-expect-error: Override protected value
		window.location = new URL('https://brandtegrity.io?test=value#unused=fragment');
		window.opener = { postMessage: postMessageSpy };

		void popupCallbackHandler('', 'query');

		await vi.waitFor(() => expect(postMessageSpy).toHaveBeenCalledWith({ test: 'value' }, '*'));
	});

	test('responseMode: fragment', async () => {
		const postMessageSpy = vi.fn().mockImplementation(() => {});

		// @ts-expect-error: Override protected value
		window.location = new URL('https://brandtegrity.io?unused=query#test=value');
		window.opener = { postMessage: postMessageSpy };

		void popupCallbackHandler('', 'fragment');

		await vi.waitFor(() => expect(postMessageSpy).toHaveBeenCalledWith({ test: 'value' }, '*'));
	});
});
