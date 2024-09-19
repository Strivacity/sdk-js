import type { RedirectParams, ResponseMode, PopupWindowParams, PopupWindowFeatures } from '../types';

let popupWindow: WindowProxy | null = null;

/**
 * Handles URL redirection to a target window using a specified location method.
 *
 * @param {URL} url The URL to redirect to.
 * @param {RedirectParams} [options] Optional parameters for the redirection, including the target window and location method.
 * @param {boolean} [shouldWait=true] Whether to wait for the previous action (default is true).
 * @returns {Promise<void>} A promise that resolves when the redirection occurs.
 */
async function redirectUrlHandler(url: URL, options?: RedirectParams, shouldWait = true): Promise<void> {
	const targetWindow = options?.targetWindow === 'top' ? window.top : window.self;
	const method = options?.locationMethod || 'assign';

	if (targetWindow) {
		targetWindow.location[method](url);
	}

	if (shouldWait) {
		// NOTE: Wait for the previous action
		return new Promise(() => undefined);
	}
}

/**
 * Handles the callback after a redirect and parses the response from the URL.
 *
 * @param {string} [url=globalThis.window?.location.href] The URL to parse, defaults to the current window location.
 * @param {ResponseMode} responseMode The response mode, either 'query' or 'fragment'.
 * @returns {Record<string, string>} A key-value map of the parsed URL parameters.
 */
function redirectCallbackHandler(url: string = globalThis.window?.location.href, responseMode: ResponseMode): Record<string, string> {
	const data = new URL(url)[responseMode === 'query' ? 'search' : 'hash'].slice(1);

	return Object.fromEntries(new URLSearchParams(data));
}

/**
 * Opens a popup window to handle URL redirection and resolves with the data received from the popup.
 *
 * @param {URL} url The URL to redirect to in the popup.
 * @param {PopupWindowParams} [options] Optional parameters for the popup, including window features and target.
 * @returns {Promise<Record<string, string>>} A promise that resolves to the data received from the popup window.
 * @throws {Error} If the popup window is blocked or closed by the user.
 */
async function popupUrlHandler(url: URL, options?: PopupWindowParams): Promise<Record<string, string>> {
	const disposables = new Set<() => void>();
	const closeWindow = (): void => {
		if (popupWindow) {
			if (!popupWindow.closed) {
				popupWindow.close();
			}

			popupWindow = null;
		}

		for (const dispose of disposables) {
			dispose();
		}

		disposables.clear();
	};

	if (popupWindow) {
		closeWindow();
	}

	const popupWindowFeatures: PopupWindowFeatures = {
		location: false,
		toolbar: false,
		height: 640,
		...options?.popupWindowFeatures,
	};

	if (popupWindowFeatures.width === undefined) {
		popupWindowFeatures.width = [800, 720, 600, 480].find((width) => width <= window.outerWidth / 1.618) ?? 360;
	}

	popupWindowFeatures.left = Math.max(0, Math.round(window.screenX + (window.outerWidth - popupWindowFeatures.width) / 2));

	if (popupWindowFeatures.height !== undefined) {
		popupWindowFeatures.top = Math.max(0, Math.round(window.screenY + (window.outerHeight - popupWindowFeatures.height) / 2));
	}

	popupWindow = window.open(
		undefined,
		options?.popupWindowTarget || '_blank',
		Object.entries(popupWindowFeatures)
			.filter(([, value]) => value !== null)
			.map(([key, value]) => `${key}=${typeof value !== 'boolean' ? (value as string) : value ? 'yes' : 'no'}`)
			.join(','),
	);

	if (!popupWindow) {
		throw Error('Popup window blocked');
	}

	popupWindow.focus();
	popupWindow.location.replace(url);

	const data = await new Promise<Record<string, string>>((resolve, reject) => {
		const listener = async (event: MessageEvent<Record<string, string>>) => {
			if (event.origin === window.location.origin && event.source === popupWindow && event.data) {
				resolve(event.data);
			}
		};

		const timer = setInterval(() => {
			if (popupWindow?.closed) {
				clearInterval(timer);
				reject(Error('Popup closed by user'));
			}
		}, 500);

		window.addEventListener('message', listener);
		disposables.add(() => window.removeEventListener('message', listener));
		disposables.add(() => clearInterval(timer));
	});

	closeWindow();

	return data;
}

/**
 * Handles the callback from a popup window, parsing the response parameters from the URL and posting them to the opener window.
 *
 * @param {ResponseMode} responseMode The response mode, either 'query' or 'fragment'.
 */
function popupCallbackHandler(responseMode: ResponseMode): void {
	const args: Record<string, string> = {};

	if (responseMode === 'fragment') {
		new URLSearchParams(globalThis.window?.location.hash.replace('#', '?')).forEach((value, key) => (args[key] = value));
	} else {
		new URLSearchParams(globalThis.window?.location.search).forEach((value, key) => (args[key] = value));
	}

	globalThis.window?.opener?.postMessage(args, '*');
}

export { redirectUrlHandler, redirectCallbackHandler, popupUrlHandler, popupCallbackHandler };
