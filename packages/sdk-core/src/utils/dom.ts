/**
 * Injects an async ES module script, deduplicating by id.
 *
 * @param {string} id - A unique identifier for the script element.
 * @param {string} src - The URL of the script to inject.
 */
export function injectScript(id: string, src: string): void {
	if (typeof document === 'undefined' || document.getElementById(id)) {
		return;
	}

	const script = document.createElement('script');

	script.id = id;
	script.src = src;
	script.async = true;
	script.type = 'module';

	document.body.appendChild(script);
}
