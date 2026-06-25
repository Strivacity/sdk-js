import { describe, test, expect, vi } from 'vitest';
import { redirectUrlHandler, redirectCallbackHandler } from '../../../src/handlers';
import { ProtocolError } from '../../../src/utils';

describe('redirectUrlHandler', () => {
	test('should reject when no URL is provided', async () => {
		await expect(redirectUrlHandler()).rejects.toThrow('No URL provided for redirection');
	});

	test('should call location.assign on the current window by default', async () => {
		const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);

		await redirectUrlHandler('https://example.com/');

		expect(assignSpy).toHaveBeenCalledWith('https://example.com/');
	});

	test('should call location.replace when locationMethod is "replace"', async () => {
		const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => undefined);

		await redirectUrlHandler('https://example.com/', { locationMethod: 'replace' });

		expect(replaceSpy).toHaveBeenCalledWith('https://example.com/');
	});

	test('should redirect the top window when targetWindow is "top"', async () => {
		const topAssign = vi.fn();
		vi.spyOn(window, 'top', 'get').mockReturnValue({ location: { assign: topAssign } } as unknown as Window & typeof globalThis);

		await redirectUrlHandler('https://example.com/', { targetWindow: 'top' });

		expect(topAssign).toHaveBeenCalledWith('https://example.com/');
	});

	test('should resolve without navigating when the target window is unavailable', async () => {
		vi.spyOn(window, 'self', 'get').mockReturnValue(undefined as unknown as Window & typeof globalThis);

		await expect(redirectUrlHandler('https://example.com/')).resolves.toBeUndefined();
	});
});

describe('redirectCallbackHandler', () => {
	test('should reject when no URL is provided', async () => {
		await expect(redirectCallbackHandler('')).rejects.toThrow('No URL provided for redirect callback handling');
	});

	test('should parse parameters from the query string by default', async () => {
		await expect(redirectCallbackHandler('https://example.com/callback?code=abc&state=xyz')).resolves.toEqual({ code: 'abc', state: 'xyz' });
	});

	test('should parse parameters from the fragment when responseMode is "fragment"', async () => {
		await expect(redirectCallbackHandler('https://example.com/callback#code=abc&state=xyz', 'fragment')).resolves.toEqual({ code: 'abc', state: 'xyz' });
	});

	test('should resolve with an empty object when there are no parameters', async () => {
		await expect(redirectCallbackHandler('https://example.com/callback')).resolves.toEqual({});
	});

	test('should reject with a ProtocolError when a parameter is duplicated', async () => {
		await expect(redirectCallbackHandler('https://example.com/callback?code=abc&code=def')).rejects.toThrow(ProtocolError);
	});

	test('should not read a code delivered in the fragment when configured for query mode', async () => {
		await expect(redirectCallbackHandler('https://example.com/callback#code=abc&state=xyz')).resolves.toEqual({});
	});

	test('should not read a code delivered in the query when configured for fragment mode', async () => {
		await expect(redirectCallbackHandler('https://example.com/callback?code=abc&state=xyz', 'fragment')).resolves.toEqual({});
	});
});
