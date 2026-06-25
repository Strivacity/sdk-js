import type { EntryResponse, ExtraRequestArgs, SDK } from './oidc';

export declare const WidgetTypeList: readonly [
	'layout',
	'submit',
	'close',
	'static',
	'input',
	'checkbox',
	'password',
	'select',
	'multiSelect',
	'passcode',
	'date',
	'phone',
	'loading',
	'passkeyLogin',
	'passkeyEnroll',
	'webauthnLogin',
	'webauthnEnroll',
];

export type WidgetType = (typeof WidgetTypeList)[number];

export declare const SelectOptionTypeList: readonly ['item', 'group'];

export type SelectOptionType = (typeof SelectOptionTypeList)[number];

export type BrandingData = {
	logoUrl: string | null;
	brandName: string | null;
	copyright: string | null;
	privacyPolicyUrl: string | null;
	siteTermsUrl: string | null;
};

export type CheckboxWidget = {
	id: string;
	type: 'checkbox';
	label?: string;
	readonly?: boolean;
	value?: boolean;
	render?: {
		type: 'checkboxHidden' | 'checkboxShown';
		labelType: 'text' | 'html';
	};
	validator?: {
		required?: boolean;
	};
};

export type DateWidget = {
	id: string;
	type: 'date';
	label?: string;
	readonly?: boolean;
	value?: string;
	render?: {
		type: 'native' | 'fieldSet';
	};
	validator?: {
		notBefore?: string;
		notAfter?: string;
		required?: boolean;
	};
};

export type InputWidget = {
	id: string;
	type: 'input';
	label?: string;
	value?: string;
	readonly?: boolean;
	autocomplete?: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	inputmode: any;
	render?: {
		autocompleteHint?: string;
	};
	validator?: {
		required?: boolean;
		minLength?: number;
		maxLength?: number;
		regex?: string;
	};
};

export type PasscodeWidget = {
	id: string;
	type: 'passcode';
	label?: string;
	validator?: {
		length?: number;
	};
};

export type PasswordWidget = {
	id: string;
	type: 'password';
	label?: string;
	qualityIndicator?: boolean;
	validator?: {
		minLength?: number;
		maxLength?: number;
		maxNumericCharacterSequences?: number;
		maxRepeatedCharacters?: number;
		mustContain?: Array<'UPPERCASE' | 'LOWERCASE' | 'NUMERIC' | 'SPECIAL'>;
		restrictedCharacters?: string;
	};
};

export type PhoneWidget = {
	id: string;
	type: 'phone';
	label?: string;
	readonly?: boolean;
	value?: string;
	validator?: {
		required?: boolean;
	};
};

export type SelectWidgetOption = {
	type: 'item';
	label?: string;
	value: string;
};

export type SelectWidgetOptionGroup = {
	type: 'group';
	label?: string;
	options: Array<SelectWidgetOption>;
};

export type SelectWidget = {
	id: string;
	type: 'select';
	label?: string;
	readonly?: boolean;
	value?: string;
	render?: {
		type: 'dropdown' | 'radio';
	};
	options: Array<SelectWidgetOptionGroup | SelectWidgetOption>;
	validator?: {
		required?: boolean;
	};
};

export type MultiSelectWidget = {
	id: string;
	type: 'multiSelect';
	label?: string;
	readonly?: boolean;
	value?: Array<string>;
	options: Array<SelectWidgetOptionGroup | SelectWidgetOption>;
	validator?: {
		minSelectable?: number;
		maxSelectable?: number;
	};
};

export type StaticWidget = {
	id: string;
	type: 'static';
	value: string;
	render?: {
		type: 'html' | 'text';
	};
};

export type SubmitWidget = {
	id: string;
	type: 'submit';
	label?: string;
	render?: {
		type: 'button' | 'link';
		textColor?: string;
		bgColor?: string;
		hint?: {
			icon?: string;
			variant?: string;
		};
	};
};

export type CloseWidget = {
	id: string;
	type: 'close';
	label?: string;
	render?: {
		type: 'button' | 'link';
		textColor?: string;
		bgColor?: string;
		hint?: {
			icon?: string;
			variant?: string;
		};
	};
};

export type FormWidget = {
	id: string;
	type: 'form';
	widgets: Array<
		CheckboxWidget | DateWidget | InputWidget | PasscodeWidget | PasswordWidget | PhoneWidget | SelectWidget | MultiSelectWidget | StaticWidget | SubmitWidget
	>;
};

export type Widget = {
	type: 'widget';
	formId: string;
	widgetId: string;
};

export type LayoutWidget = {
	type: 'vertical' | 'horizontal';
	items: Array<Widget | LayoutWidget>;
};

export type PasskeyLoginWidget = {
	id: string;
	label?: string;
	render?: {
		type: 'button';
		hint?: {
			variant?: string;
		};
	};
	assertionOptions: PublicKeyCredentialRequestOptions;
};

export type PasskeyEnrollWidget = {
	id: string;
	label?: string;
	render?: {
		type: 'button';
		hint?: {
			variant?: string;
		};
	};
	enrollOptions: PublicKeyCredentialCreationOptions;
};

export type WebauthnLoginWidget = {
	id: string;
	label?: string;
	authenticatorType: 'deviceBiometrics' | 'securityKey';
	render?: {
		type: 'button';
		hint?: {
			variant?: string;
		};
	};
	assertionOptions: PublicKeyCredentialRequestOptions;
};

export type WebauthnEnrollWidget = {
	id: string;
	label?: string;
	authenticatorType: 'deviceBiometrics' | 'securityKey';
	render?: {
		type: 'button';
		hint?: {
			variant?: string;
		};
	};
	enrollOptions: PublicKeyCredentialCreationOptions;
};

export type LoginFlowMessage = {
	type: string;
	text: string;
};

export type LoginFlowState = {
	hostedUrl?: string;
	finalizeUrl?: string;
	screen?: string;
	branding?: BrandingData;
	forms?: Array<FormWidget>;
	layout?: LayoutWidget;
	messages?: Record<string, Record<string, LoginFlowMessage>> & {
		global?: LoginFlowMessage;
	};
};

export type NativeParams = ExtraRequestArgs & { sdk?: string; sessionId?: string; language?: string };

export type NativeLoginFlow = {
	/**
	 * The session ID of the current native login flow, or `null` if no session has been started.
	 *
	 * @type {string | null}
	 * @deprecated Use `sdk.sessionId` instead of accessing this via the login flow instance.
	 */
	sessionId: string | null;

	/**
	 * The short application ID associated with the current native login flow, or `null` if not yet available.
	 *
	 * @type {string | null}
	 * @deprecated Use `sdk.shortAppId` instead of accessing this via the login flow instance.
	 */
	shortAppId: string | null;

	/**
	 * The language code used for the native login flow UI.
	 *
	 * @type {string}
	 * @deprecated Use `sdk.language` instead of accessing this via the login flow instance.
	 */
	language: string;

	/**
	 * Starts the native login session with the given parameters.
	 *
	 * @param {NativeParams} loginParams - The parameters to use when starting the session.
	 * @returns {Promise<void>}
	 * @deprecated Use `sdk.startSession()` instead of calling this via the login flow instance.
	 */
	startSession(loginParams: NativeParams): Promise<void>;

	/**
	 * Finalizes the native login session by processing the callback URL.
	 *
	 * @param {string | URL} url - The callback URL returned after authentication.
	 * @returns {Promise<void>}
	 * @deprecated Use `sdk.finalizeSession()` instead of calling this via the login flow instance.
	 */
	finalizeSession(url: string | URL): Promise<void>;

	/**
	 * Submits a login form with the given form ID and body data.
	 *
	 * @param {string} [formId] - The ID of the form to submit.
	 * @param {Record<string, unknown>} [body] - The form field values to submit.
	 * @returns {Promise<LoginFlowState>} The resulting login flow state after submission.
	 * @deprecated Use `sdk.submitForm()` instead of calling this via the login flow instance.
	 */
	submitForm(formId?: string, body?: Record<string, unknown>): Promise<LoginFlowState>;
};

export type NativeFlow = Omit<SDK<NativeParams, Promise<EntryResponse>>, 'login' | 'register'> & {
	/**
	 * Starts the native authentication session with the given parameters.
	 *
	 * @param {NativeParams} loginParams - The parameters to use when starting the session.
	 * @returns {Promise<void>}
	 */
	startSession(loginParams: NativeParams): Promise<void>;

	/**
	 * Finalizes the native authentication session by processing the callback URL.
	 *
	 * @param {string | URL} url - The callback URL returned after authentication.
	 * @returns {Promise<void>}
	 */
	finalizeSession(url: string | URL): Promise<void>;

	/**
	 * Submits a login form with the given form ID and body data.
	 *
	 * @param {string} [formId] - The ID of the form to submit.
	 * @param {Record<string, unknown>} [body] - The form field values to submit.
	 * @returns {Promise<LoginFlowState>} The resulting login flow state after submission.
	 */
	submitForm(formId?: string, body?: Record<string, unknown>): Promise<LoginFlowState>;

	/**
	 * Initiates the native login flow and returns a `NativeLoginFlow` instance to drive the process.
	 *
	 * @param {NativeParams} [params] - Optional parameters for the login request.
	 * @returns {NativeLoginFlow} Native login flow instance to drive the process.
	 */
	login(params?: NativeParams): NativeLoginFlow;

	/**
	 * Initiates the native registration flow and returns a `NativeLoginFlow` instance to drive the process.
	 *
	 * @param {NativeParams} [params] - Optional parameters for the registration request.
	 * @returns {NativeLoginFlow} Native login flow instance to drive the process.
	 */
	register(params?: NativeParams): NativeLoginFlow;
};
