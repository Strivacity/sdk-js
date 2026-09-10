import type { ExtraRequestArgs, SDK } from './oidc';

export type PopupWindowFeatures = {
	/**
	 * The horizontal position of the popup window relative to the left edge of the screen.
	 */
	left?: number;

	/**
	 * The vertical position of the popup window relative to the top edge of the screen.
	 */
	top?: number;

	/**
	 * The width of the popup window.
	 */
	width?: number;

	/**
	 * The height of the popup window.
	 */
	height?: number;

	/**
	 * Whether the popup window should display a menubar.
	 * Can be a boolean value or a string ('yes' or 'no').
	 */
	menubar?: boolean | string;

	/**
	 * Whether the popup window should display a toolbar.
	 * Can be a boolean value or a string ('yes' or 'no').
	 */
	toolbar?: boolean | string;

	/**
	 * Whether the popup window should display the address/location bar.
	 * Can be a boolean value or a string ('yes' or 'no').
	 */
	location?: boolean | string;

	/**
	 * Whether the popup window should display a status bar.
	 * Can be a boolean value or a string ('yes' or 'no').
	 */
	status?: boolean | string;

	/**
	 * Whether the popup window should be resizable.
	 * Can be a boolean value or a string ('yes' or 'no').
	 */
	resizable?: boolean | string;

	/**
	 * Whether the popup window should display scrollbars.
	 * Can be a boolean value or a string ('yes' or 'no').
	 */
	scrollbars?: boolean | string;

	[key: string]: boolean | string | number | undefined;
};

export type PopupParams = ExtraRequestArgs & {
	/**
	 * Configuration options for the popup window, including size, position, and other features.
	 */
	popupWindowFeatures?: PopupWindowFeatures;

	/**
	 * The target of the popup window, which specifies where the popup should be opened.
	 */
	popupWindowTarget?: string;

	/**
	 * Whether to check the origin of messages received from the popup window.
	 * If set to `true`, the SDK will verify that messages received from the popup window originate from the expected domain.
	 * This is a security measure to prevent malicious scripts from sending unauthorized messages to the application.
	 *
	 * @default true
	 */
	checkOrigin?: boolean;
};

export type PopupFlow = SDK<PopupParams>;
