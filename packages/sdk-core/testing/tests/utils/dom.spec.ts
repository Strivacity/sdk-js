import { describe, test, expect, vi, afterEach } from 'vitest';
import { injectScript } from '../../../src/utils/dom';

describe('injectScript', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		document.getElementById('script-id')?.remove();
	});

	test('appends a script element with the given id, src, async and module type', () => {
		injectScript('script-id', 'https://brandtegrity.io/script.js');

		const script = document.getElementById('script-id') as HTMLScriptElement;

		expect(script).not.toBeNull();
		expect(script.src).toBe('https://brandtegrity.io/script.js');
		expect(script.async).toBe(true);
		expect(script.type).toBe('module');
		expect(script.parentElement).toBe(document.body);
	});

	test('does not inject a second script when an element with the same id already exists', () => {
		injectScript('script-id', 'https://brandtegrity.io/first.js');
		injectScript('script-id', 'https://brandtegrity.io/second.js');

		const script = document.getElementById('script-id') as HTMLScriptElement;

		expect(script.src).toBe('https://brandtegrity.io/first.js');
		expect(document.querySelectorAll('#script-id').length).toBe(1);
	});

	test('is a no-op when document is unavailable', () => {
		vi.stubGlobal('document', undefined);

		expect(() => injectScript('script-id', 'https://brandtegrity.io/script.js')).not.toThrow();
	});
});
