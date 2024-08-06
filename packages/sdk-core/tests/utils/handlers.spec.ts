import { vi, describe, it, expect } from 'vitest';
import { redirectUrlHandler, redirectCallbackHandler, popupUrlHandler, popupCallbackHandler } from '../../src/utils/handlers';

describe('redirectUrlHandler', () => {
	['self', 'top'].forEach((targetWindow) =>
		it(`targetWindow: ${targetWindow}`, async () => {
			const locationMethodSpy = vi.spyOn(window[targetWindow].location, 'assign').mockImplementation(() => {});
			const url = new URL('https://brandtegrity.io');

			await redirectUrlHandler(url, { targetWindow: targetWindow as 'self' | 'top' }, false);

			expect(locationMethodSpy).toHaveBeenCalledWith(url);
		}),
	);

	['assign', 'replace'].forEach((locationMethod) =>
		it(`locationMethod: ${locationMethod}`, async () => {
			const locationMethodSpy = vi.spyOn(window.self.location, locationMethod as 'assign' | 'replace').mockImplementation(() => {});
			const url = new URL('https://brandtegrity.io');

			await redirectUrlHandler(url, { locationMethod: locationMethod as 'assign' | 'replace' }, false);

			expect(locationMethodSpy).toHaveBeenCalledWith(url);
		}),
	);
});

describe('redirectCallbackHandler', () => {
	it('responseMode: query', async () => {
		expect(redirectCallbackHandler('https://brandtegrity.io?test=value#unused=fragment', 'query')).toEqual({ test: 'value' });
	});

	it('responseMode: fragment', async () => {
		expect(redirectCallbackHandler('https://brandtegrity.io?unused=query#test=value', 'fragment')).toEqual({ test: 'value' });
	});
});

describe('popupUrlHandler', () => {
	const url = new URL('https://brandtegrity.io');

	it('should open correctly', async () => {
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

	it('should set popup window target correctly', async () => {
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

	it('should set additional popup window features correctly', async () => {
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

	it('should handle close by user correctly', async () => {
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

	it('should handle popup blocking correctly', async () => {
		// @ts-expect-error: Override window.open
		vi.spyOn(window, 'open').mockImplementation(() => {});

		await expect(() => popupUrlHandler(url)).rejects.toThrowError('Popup window blocked');
	});
});

describe('popupCallbackHandler', () => {
	it('responseMode: query', () => {
		const postMessageSpy = vi.fn().mockImplementation(() => {});

		// @ts-expect-error: Override protected value
		window.location = new URL('https://brandtegrity.io?test=value#unused=fragment');
		window.opener = { postMessage: postMessageSpy };

		popupCallbackHandler('query');

		expect(postMessageSpy).toHaveBeenCalledWith({ test: 'value' }, '*');
	});

	it('responseMode: fragment', () => {
		const postMessageSpy = vi.fn().mockImplementation(() => {});

		// @ts-expect-error: Override protected value
		window.location = new URL('https://brandtegrity.io?unused=query#test=value');
		window.opener = { postMessage: postMessageSpy };

		popupCallbackHandler('fragment');

		expect(postMessageSpy).toHaveBeenCalledWith({ test: 'value' }, '*');
	});
});
