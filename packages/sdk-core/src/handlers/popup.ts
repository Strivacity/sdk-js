import type { ResponseMode } from '../types/oidc';
import type { PopupParams, PopupWindowFeatures } from '../types/popup';
import { PopupBlockedError, PopupClosedError } from '../utils/errors';

let activePopup: WindowProxy | null = null;

/**
 * Closes the currently active popup window and cleans up any associated resources.
 *
 * @param {Set<() => void>} disposables - A set of cleanup functions to be called when the popup is closed.
 */
function closePopup(disposables: Set<() => void>): void {
	if (activePopup && !activePopup.closed) {
		activePopup.close();
	}

	activePopup = null;
	disposables.forEach((d) => d());
	disposables.clear();
}

/**
 * Opens a popup window to handle URL redirection and resolves with the data received from the popup.
 *
 * @param {string | URL | ((popupWindow: Window) => void | Promise<void>)} urlOrPopupHandler - The URL to open in the popup or a function that handles the popup window.
 * @param {PopupParams} [params] - Optional parameters for configuring the popup window, such as features and target.
 * @param {PopupWindowFeatures} [params.popupWindowFeatures] - Optional features for the popup window, such as width, height, and position.
 * @param {string} [params.popupWindowTarget] - Optional target for the popup window, such as '_blank' or a named window.
 * @param {boolean} [params.checkOrigin] - Optional flag to check the origin of the message received from the popup window.
 * @returns {Promise<Record<string, string>>} A promise that resolves with the data received from the popup window, or rejects if the popup is blocked or closed by the user.
 * @throws {Error} If the popup window is blocked or closed by the user.
 */
export async function popupUrlHandler(
	urlOrPopupHandler: string | URL | ((popupWindow: Window) => void | Promise<void>),
	params?: PopupParams,
): Promise<Record<string, string>> {
	const disposables = new Set<() => void>();

	// NOTE: Close any leftover popup from a previous call
	if (activePopup) {
		closePopup(disposables);
	}

	const features: PopupWindowFeatures = {
		location: false,
		toolbar: false,
		height: 640,
		...params?.popupWindowFeatures,
	};

	if (features.width === undefined) {
		features.width = [800, 720, 600, 480].find((w) => w <= globalThis.window.outerWidth / 1.618) ?? 360;
	}

	features.left = Math.max(0, Math.round(globalThis.window.screenX + (globalThis.window.outerWidth - features.width) / 2));

	if (features.height !== undefined) {
		features.top = Math.max(0, Math.round(globalThis.window.screenY + (globalThis.window.outerHeight - features.height) / 2));
	}

	activePopup = globalThis.open(
		undefined,
		params?.popupWindowTarget ?? '_blank',
		Object.entries(features)
			.filter(([, v]) => v !== null)
			.map(([k, v]) => `${k}=${typeof v !== 'boolean' ? v : v ? 'yes' : 'no'}`)
			.join(','),
	);

	if (!activePopup) {
		throw new PopupBlockedError();
	}

	activePopup.focus();

	if (typeof urlOrPopupHandler === 'function') {
		await urlOrPopupHandler(activePopup);
	} else {
		activePopup.location.replace(urlOrPopupHandler);
	}

	try {
		return await new Promise<Record<string, string>>((resolve, reject) => {
			const listener = (event: MessageEvent<Record<string, string>>) => {
				const sameOrigin = !params?.checkOrigin || event.origin === globalThis.location?.origin;

				if (sameOrigin && event.source === activePopup && event.data) {
					resolve(event.data);
				}
			};

			const timer = setInterval(() => {
				if (activePopup?.closed) {
					clearInterval(timer);
					reject(new PopupClosedError());
				}
			}, 500);

			globalThis.window.addEventListener('message', listener);
			disposables.add(() => globalThis.window.removeEventListener('message', listener));
			disposables.add(() => clearInterval(timer));
		});
	} finally {
		closePopup(disposables);
	}
}

/**
 * Handles the callback from a popup window, parsing the response parameters from the URL and posting them to the opener window.
 *
 * @param {string} [_url] - the URL is not used in this function, but it is kept for type compatibility.
 * @param {ResponseMode} responseMode The response mode, either 'query' or 'fragment'.
 */
export function popupCallbackHandler(_url?: string | URL, responseMode?: ResponseMode): Promise<void> {
	const raw = responseMode === 'fragment' ? globalThis.window?.location.hash.replace('#', '?') : globalThis.window?.location.search;
	let args: Record<string, string> = {};

	for (const [key, value] of new URLSearchParams(raw).entries()) {
		if (key in args) {
			args = { error: 'invalid_request', error_description: `Duplicate parameter in popup callback: ${key}` };
			break;
		}

		args[key] = value;
	}

	globalThis.window?.opener?.postMessage(args, '*');

	// NOTE: Stay suspended – the opener will close the popup after the token exchange
	return new Promise(() => undefined);
}
