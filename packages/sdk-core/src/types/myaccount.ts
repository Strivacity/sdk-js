/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HttpClientData, PartialRecord, UnionToIntersection } from './common';
import type * as myaccountAPI from '@strivacity/sdk-core/utils/myaccount';

export const PermissionList = [
	'myDataDownload',
	'accountRemove',
	'passwordChange',
	'personalInformationManage',
	'consentManage',
	'applicationLauncher',
	'notificationPreferenceManage',
] as const;
export type Permission = (typeof PermissionList)[number];

export const AttributeTypeList = [
	'identifier',
	'password',
	'checkbox',
	'string',
	'email',
	'select',
	'phoneNumber',
	'date',
	'compoundAddress',
	'consent',
	'static',
	'complexList',
	'stringList',
	'emailList',
	'phoneNumberList',
	'selectList',
	'dateList',
] as const;
export type AttributeType = (typeof AttributeTypeList)[number];

export type EnabledIdentifier = 'email' | 'username' | 'phone';

type AttributeIdentifierBase = {
	/**
	 * The type of identifier this attribute represents.
	 *
	 * @type {EnabledIdentifier}
	 */
	identifierType: EnabledIdentifier;

	/**
	 * Whether the user can edit this identifier.
	 *
	 * @type {boolean}
	 */
	editable?: boolean;

	/**
	 * Whether this identifier is required.
	 *
	 * @type {boolean}
	 */
	required?: boolean;
};

type AttributeNonIdentifierBase = {
	/**
	 * The attribute type discriminator.
	 *
	 * @type {AttributeType}
	 */
	type: AttributeType;

	/**
	 * Dot-notation path to the attribute value in the user profile.
	 *
	 * @type {string}
	 */
	path: string;

	/**
	 * Human-readable label shown in the UI.
	 *
	 * @type {string}
	 */
	displayName: string;

	/**
	 * Whether the user can edit this attribute.
	 *
	 * @type {boolean}
	 */
	editable?: boolean;

	/**
	 * Whether this attribute must have a value.
	 *
	 * @type {boolean}
	 */
	required?: boolean;

	/**
	 * Whether the attribute is displayed but cannot be modified.
	 *
	 * @type {boolean}
	 */
	readOnly?: boolean;
};

type AttributeListBase = AttributeNonIdentifierBase & {
	/**
	 * Optional constraints on the number of items in the list.
	 */
	listValidator?: {
		/**
		 * Minimum number of items.
		 *
		 * @type {number}
		 */
		min?: number;

		/**
		 * Maximum number of items.
		 *
		 * @type {number}
		 */
		max?: number;
	};
};

export type EmailIdentifierAttribute = AttributeIdentifierBase & {
	/**
	 * Discriminant narrowed to `'email'`.
	 *
	 * @type {'email'}
	 */
	identifierType: 'email';
};

export type PhoneIdentifierAttribute = AttributeIdentifierBase & {
	/**
	 * Discriminant narrowed to `'phone'`.
	 *
	 * @type {'phone'}
	 */
	identifierType: 'phone';
};

export type UsernameIdentifierAttribute = AttributeIdentifierBase & {
	/**
	 * Discriminant narrowed to `'username'`.
	 *
	 * @type {'username'}
	 */
	identifierType: 'username';

	/**
	 * Optional length and format constraints for the username.
	 */
	validator?: {
		/**
		 * Minimum character length.
		 *
		 * @type {number}
		 */
		min: number;

		/**
		 * Maximum character length.
		 *
		 * @type {number}
		 */
		max: number;

		/**
		 * Optional regex pattern the username must match.
		 *
		 * @type {string}
		 */
		regex?: string;

		/**
		 * Message shown when the regex validation fails.
		 *
		 * @type {string}
		 */
		errorMessage?: string;
	};
};

export type CheckboxAttribute = AttributeNonIdentifierBase & {
	/**
	 * Discriminant narrowed to `'checkbox'`.
	 *
	 * @type {'checkbox'}
	 */
	type: 'checkbox';

	/**
	 * Default checked state when no value is set.
	 *
	 * @type {boolean}
	 */
	default?: boolean;
};

export type StringAttribute = AttributeNonIdentifierBase & {
	/**
	 * Discriminant narrowed to `'string'`.
	 *
	 * @type {'string'}
	 */
	type: 'string';

	/**
	 * Default value when no value is set.
	 *
	 * @type {string}
	 */
	default?: string;

	/**
	 * HTML autocomplete attribute hint (e.g. `'given-name'`).
	 *
	 * @type {string}
	 */
	autocomplete?: string;

	/**
	 * Optional length and format constraints.
	 */
	validator?: {
		/**
		 * Minimum character length.
		 *
		 * @type {number}
		 */
		min: number;

		/**
		 * Maximum character length.
		 *
		 * @type {number}
		 */
		max: number;

		/**
		 * Optional regex pattern the value must match.
		 *
		 * @type {string}
		 */
		regex?: string;

		/**
		 * Message shown when the regex validation fails.
		 *
		 * @type {string}
		 */
		errorMessage?: string;
	};
};

export type EmailAttribute = AttributeNonIdentifierBase & {
	/**
	 * Discriminant narrowed to `'email'`.
	 *
	 * @type {'email'}
	 */
	type: 'email';

	/**
	 * HTML autocomplete attribute hint.
	 *
	 * @type {string}
	 */
	autocomplete?: string;
};

export type SelectAttribute = AttributeNonIdentifierBase & {
	/**
	 * Discriminant narrowed to `'select'`.
	 *
	 * @type {'select'}
	 */
	type: 'select';

	/**
	 * Default selected value.
	 *
	 * @type {string}
	 */
	default?: string;

	/**
	 * How the select should be rendered in the UI.
	 *
	 * @type {'native' | 'radio'}
	 */
	renderType: 'native' | 'radio';

	/**
	 * Available options.
	 *
	 * @type {Array<{ value: string; displayName: string; hidden?: boolean }>}
	 */
	values: Array<{
		/**
		 * The stored value.
		 *
		 * @type {string}
		 */
		value: string;

		/**
		 * The label shown to the user.
		 *
		 * @type {string}
		 */
		displayName: string;

		/**
		 * When true the option is hidden in the UI but may still be stored.
		 *
		 * @type {boolean}
		 */
		hidden?: boolean;
	}>;
};

export type PhoneNumberAttribute = AttributeNonIdentifierBase & {
	/**
	 * Discriminant narrowed to `'phoneNumber'`.
	 *
	 * @type {'phoneNumber'}
	 */
	type: 'phoneNumber';
};

export type DateAttribute = AttributeNonIdentifierBase & {
	/**
	 * Discriminant narrowed to `'date'`.
	 *
	 * @type {'date'}
	 */
	type: 'date';

	/**
	 * How the date input should be rendered.
	 *
	 * @type {'native' | 'fieldSet'}
	 */
	renderType: 'native' | 'fieldSet';

	/**
	 * Optional allowed date range constraints.
	 */
	validator?: {
		/**
		 * Absolute earliest allowed date (ISO 8601).
		 *
		 * @type {string}
		 */
		notBefore?: string;

		/**
		 * Absolute latest allowed date (ISO 8601).
		 *
		 * @type {string}
		 */
		notAfter?: string;

		/**
		 * Relative earliest allowed date expressed as days from today (negative = past).
		 *
		 * @type {number}
		 */
		notBeforeRelativeDays?: number;

		/**
		 * Relative latest allowed date expressed as days from today.
		 *
		 * @type {number}
		 */
		notAfterRelativeDays?: number;
	};
};

export type StringListAttribute = AttributeListBase & {
	/**
	 * Discriminant narrowed to `'stringList'`.
	 *
	 * @type {'stringList'}
	 */
	type: 'stringList';

	/**
	 * HTML autocomplete hint for each item input.
	 *
	 * @type {string}
	 */
	autocomplete?: string;

	/**
	 * Optional length and format constraints applied to each item.
	 */
	validator?: {
		/**
		 * Minimum character length per item.
		 *
		 * @type {number}
		 */
		min?: number;

		/**
		 * Maximum character length per item.
		 *
		 * @type {number}
		 */
		max?: number;

		/**
		 * Optional regex pattern each item must match.
		 *
		 * @type {string}
		 */
		regex?: string;

		/**
		 * Message shown when the regex validation fails.
		 *
		 * @type {string}
		 */
		errorMessage?: string;
	};
};

export type EmailListAttribute = AttributeListBase & {
	/**
	 * Discriminant narrowed to `'emailList'`.
	 *
	 * @type {'emailList'}
	 */
	type: 'emailList';

	/**
	 * HTML autocomplete hint for each item input.
	 *
	 * @type {string}
	 */
	autocomplete?: string;
};

export type PhoneNumberListAttribute = AttributeListBase & {
	/**
	 * Discriminant narrowed to `'phoneNumberList'`.
	 *
	 * @type {'phoneNumberList'}
	 */
	type: 'phoneNumberList';
};

export type SelectListAttribute = AttributeListBase & {
	/**
	 * Discriminant narrowed to `'selectList'`.
	 *
	 * @type {'selectList'}
	 */
	type: 'selectList';

	/**
	 * How the select should be rendered in the UI.
	 *
	 * @type {'native' | 'radio'}
	 */
	renderType: 'native' | 'radio';

	/**
	 * Available options.
	 *
	 * @type {Array<{ value: string; displayName: string }>}
	 */
	values: Array<{
		/**
		 * The stored value.
		 *
		 * @type {string}
		 */
		value: string;

		/**
		 * The label shown to the user.
		 *
		 * @type {string}
		 */
		displayName: string;
	}>;
};

export type DateListAttribute = AttributeListBase & {
	/**
	 * Discriminant narrowed to `'dateList'`.
	 *
	 * @type {'dateList'}
	 */
	type: 'dateList';

	/**
	 * How each date input should be rendered.
	 *
	 * @type {'native' | 'fieldSet'}
	 */
	renderType: 'native' | 'fieldSet';

	/**
	 * Optional allowed date range constraints applied to each item.
	 */
	validator?: {
		/**
		 * Absolute earliest allowed date (ISO 8601).
		 *
		 * @type {string}
		 */
		notBefore?: string;

		/**
		 * Absolute latest allowed date (ISO 8601).
		 *
		 * @type {string}
		 */
		notAfter?: string;

		/**
		 * Relative earliest allowed date expressed as days from today.
		 *
		 * @type {number}
		 */
		notBeforeRelativeDays?: number;

		/**
		 * Relative latest allowed date expressed as days from today.
		 *
		 * @type {number}
		 */
		notAfterRelativeDays?: number;
	};
};

export type ComplexListChildAttribute = Exclude<Attribute, IdentifierAttribute | ListAttribute | ComplexListAttribute> & {
	/**
	 * When true, duplicate values for this child attribute are not allowed within the list.
	 *
	 * @type {boolean}
	 */
	uniqueInTheList?: boolean;
};

export type ComplexListAttribute = AttributeListBase & {
	/**
	 * Discriminant narrowed to `'complexList'`.
	 *
	 * @type {'complexList'}
	 */
	type: 'complexList';

	/**
	 * The attributes that make up each item in the list.
	 *
	 * @type {Array<ComplexListChildAttribute>}
	 */
	childAttributes: Array<ComplexListChildAttribute>;
};

export type ListAttribute =
	| StringListAttribute
	| EmailListAttribute
	| PhoneNumberListAttribute
	| SelectListAttribute
	| DateListAttribute
	| ComplexListAttribute;

export type IdentifierAttribute = EmailIdentifierAttribute | PhoneIdentifierAttribute | UsernameIdentifierAttribute;

export type NonIdentifierAttribute =
	| StringAttribute
	| EmailAttribute
	| CheckboxAttribute
	| PhoneNumberAttribute
	| SelectAttribute
	| DateAttribute
	| ListAttribute
	| ComplexListAttribute;

export type Attribute =
	| StringAttribute
	| EmailAttribute
	| CheckboxAttribute
	| PhoneNumberAttribute
	| SelectAttribute
	| DateAttribute
	| ListAttribute
	| ComplexListAttribute;

export type AccountData = Record<string, any>;

export type AccountInfo = {
	/**
	 * The username of the authenticated user, or null if not set.
	 *
	 * @type {string | null}
	 */
	userName: string | null;

	/**
	 * The primary email address of the authenticated user, or null if not set.
	 *
	 * @type {string | null}
	 */
	email: string | null;

	/**
	 * URL to the user's profile picture.
	 *
	 * @type {string}
	 */
	picture?: string;

	/**
	 * The user's display name components.
	 */
	name: {
		/**
		 * The user's given (first) name, or null if not set.
		 *
		 * @type {string | null}
		 */
		givenName: string | null;

		/**
		 * The user's family (last) name, or null if not set.
		 *
		 * @type {string | null}
		 */
		familyName: string | null;
	};

	/**
	 * The organization the user belongs to, if any.
	 */
	organization?: {
		/**
		 * The organization's display name, or null if not set.
		 *
		 * @type {string | null}
		 */
		name: string | null;
	};

	/**
	 * Whether the user's email address has been verified.
	 *
	 * @type {boolean}
	 */
	emailVerified: boolean;

	/**
	 * Website URL of the portal.
	 *
	 * @type {string | undefined}
	 */
	portalURL?: string;

	/**
	 * The list of My Account permissions granted to the user.
	 *
	 * @type {Array<Permission>}
	 */
	permissions: Array<Permission>;
};

export type Identity = {
	/**
	 * The identifier value (e.g. email address or external provider subject).
	 *
	 * @type {string}
	 */
	value: string;

	/**
	 * The origin of this identity.
	 *
	 * @type {'local' | 'social' | 'enterprise'}
	 */
	provider: 'local' | 'social' | 'enterprise';

	/**
	 * Icon class or name representing the provider.
	 *
	 * @type {string}
	 */
	icon?: string;

	/**
	 * URL to the provider logo image.
	 *
	 * @type {string}
	 */
	logoUrl?: string;
};

export type Identities = Record<string, Identity>;

export const IdentifierTypeList = ['username', 'email', 'phone'] as const;
export type IdentifierType = (typeof IdentifierTypeList)[number];

export const IdentifierUpdatePhaseTypeList = ['challenge', 'verify'] as const;
export type IdentifierUpdatePhaseType = (typeof IdentifierUpdatePhaseTypeList)[number];

export type Identifier = IdentifierAttribute;

export type EnabledIdentifiers = PartialRecord<EnabledIdentifier, Identifier>;

export const PasswordRequiredTypeList = ['UPPERCASE', 'LOWERCASE', 'NUMERIC', 'SPECIAL'] as const;
export type PasswordRequiredType = (typeof PasswordRequiredTypeList)[number];

export const PasswordExcludeTypeList = ['USERNAME_PART', 'GIVEN_NAME', 'FAMILY_NAME'] as const;
export type PasswordExcludeType = (typeof PasswordExcludeTypeList)[number];

export type PasswordValidator = {
	/**
	 * Minimum number of characters required.
	 *
	 * @type {number}
	 */
	minLength?: number;

	/**
	 * Maximum number of characters allowed.
	 *
	 * @type {number}
	 */
	maxLength?: number;

	/**
	 * Maximum length of consecutive numeric sequences (e.g. `123`).
	 *
	 * @type {number}
	 */
	maxNumericCharacterSequences?: number;

	/**
	 * Maximum number of consecutively repeated characters.
	 *
	 * @type {number}
	 */
	maxRepeatedCharacters?: number;

	/**
	 * Characters that are not allowed in the password.
	 *
	 * @type {string}
	 */
	restrictedCharacters?: string;

	/**
	 * Character classes that must be present in the password.
	 *
	 * @type {Array<PasswordRequiredType>}
	 */
	required?: Array<PasswordRequiredType>;
};

export type PasswordPolicy = {
	/**
	 * Validation rules the new password must satisfy.
	 *
	 * @type {PasswordValidator}
	 */
	validator?: PasswordValidator;
};

export const AuthenticatorTypeList = ['custom', 'email', 'phone', 'softToken', 'passkey', 'webAuthnDeviceBiometrics', 'webAuthnSecurityKey'] as const;
export type AuthenticatorType = (typeof AuthenticatorTypeList)[number];

export const AuthenticatorMethodTypeList = ['magicLink', 'passcode', 'publicKey', 'voice'] as const;
export type AuthenticatorMethodType = (typeof AuthenticatorMethodTypeList)[number];

export const ConsentTypeList = ['optional', 'mandatory', 'mandatoryHidden'] as const;
export type ConsentType = (typeof ConsentTypeList)[number];

export type ConsentData = {
	/**
	 * Unique identifier of the consent definition.
	 *
	 * @type {string}
	 */
	consentId: string;

	/**
	 * Unique identifier of the user's consent receipt, or null if not yet accepted.
	 *
	 * @type {string | null}
	 */
	receiptId: string | null;

	/**
	 * Enforcement level of this consent.
	 *
	 * @type {ConsentType}
	 */
	type: ConsentType;

	/**
	 * The consent text shown to the user.
	 *
	 * @type {string}
	 */
	displayText: string;

	/**
	 * Whether the user has currently opted in.
	 *
	 * @type {boolean}
	 */
	accepted: boolean;
};

export type Location = {
	/**
	 * GeoJSON object type (always `'Feature'`).
	 *
	 * @type {string}
	 */
	type: string;

	/**
	 * GeoJSON geometry containing the coordinate point.
	 */
	geometry: {
		/**
		 * GeoJSON geometry type (always `'Point'`).
		 *
		 * @type {string}
		 */
		type: string;

		/**
		 * `[longitude, latitude]` coordinate pair.
		 *
		 * @type {Array<number>}
		 */
		coordinates: Array<number>;
	};

	/**
	 * Human-readable location properties derived from the coordinates.
	 */
	properties: Partial<{
		/**
		 * City name.
		 *
		 * @type {string}
		 */
		city: string;

		/**
		 * State or region name.
		 *
		 * @type {string}
		 */
		state: string;

		/**
		 * Country name.
		 *
		 * @type {string}
		 */
		country: string;

		/**
		 * ISO 3166-1 alpha-2 country code.
		 *
		 * @type {string}
		 */
		countryCode: string;
	}>;
};

export type DeviceData = {
	/**
	 * Unique session identifier.
	 *
	 * @type {string}
	 */
	id: string;

	/**
	 * Human-readable device description derived from the user agent.
	 *
	 * @type {string}
	 */
	deviceString: string;

	/**
	 * IP address of the last request in this session, or null if unavailable.
	 *
	 * @type {string | null}
	 */
	lastIP: string | null;

	/**
	 * ISO 8601 timestamp of the last login for this session, or null if unavailable.
	 *
	 * @type {string | null}
	 */
	lastLoginAt: string | null;

	/**
	 * Raw User-Agent string of the session's client.
	 *
	 * @type {string}
	 */
	userAgent: string;

	/**
	 * Approximate geographic location of the session, if available.
	 *
	 * @type {Location | null}
	 */
	location?: Location | null;
};

export type NotificationPreferenceDescriptor = {
	/**
	 * Unique identifier of this notification preference.
	 *
	 * @type {string}
	 */
	id: string;

	/**
	 * Human-readable label shown in the UI.
	 *
	 * @type {string}
	 */
	displayName: string;

	/**
	 * Optional longer description of what this preference controls.
	 *
	 * @type {string}
	 */
	description?: string;
};

export type NotificationPreferences = Record<string, boolean>;

export type Authenticator = {
	/**
	 * Unique identifier of the MFA method.
	 *
	 * @type {string}
	 */
	id: string;

	/**
	 * The authenticator type of this MFA method.
	 *
	 * @type {AuthenticatorType}
	 */
	type: AuthenticatorType;

	/**
	 * The target (e.g. masked email or phone number) associated with this method.
	 *
	 * @type {string}
	 */
	target?: string;

	/**
	 * The challenge delivery methods supported by this authenticator.
	 *
	 * @type {Array<AuthenticatorMethodType>}
	 */
	methods?: Array<AuthenticatorMethodType>;

	/**
	 * ISO 8601 timestamp of when this method was registered, or null if unavailable.
	 *
	 * @type {string | null}
	 */
	createdAt?: string | null;

	/**
	 * ISO 8601 timestamp of the last use of this method, or null if never used.
	 *
	 * @type {string | null}
	 */
	lastUsedAt?: string | null;
};

export const PhaseTypeList = ['challenge', 'verify'] as const;
export type PhaseType = (typeof PhaseTypeList)[number];

export type SupportedAuthenticators = {
	/**
	 * Supported delivery methods for the email authenticator.
	 *
	 * @type {Array<'passcode' | 'magicLink'>}
	 */
	email?: Array<'passcode' | 'magicLink'>;

	/**
	 * Supported delivery methods for the passkey authenticator.
	 *
	 * @type {Array<'publicKey'>}
	 */
	passkey?: Array<'publicKey'>;

	/**
	 * Supported delivery methods for the phone authenticator.
	 *
	 * @type {Array<'passcode' | 'voice' | 'magicLink'>}
	 */
	phone?: Array<'passcode' | 'voice' | 'magicLink'>;

	/**
	 * Supported delivery methods for the soft-token (TOTP) authenticator.
	 *
	 * @type {Array<'passcode'>}
	 */
	softToken?: Array<'passcode'>;

	/**
	 * Supported delivery methods for the WebAuthn device-biometrics authenticator.
	 *
	 * @type {Array<'publicKey'>}
	 */
	webAuthnDeviceBiometrics?: Array<'publicKey'>;

	/**
	 * Supported delivery methods for the WebAuthn security-key authenticator.
	 *
	 * @type {Array<'publicKey'>}
	 */
	webAuthnSecurityKey?: Array<'publicKey'>;
};

export type DeleteAuthenticatorChallengeResponse = {
	/**
	 * The method used to validate the delete challenge (e.g. a credential ID or authenticator type).
	 *
	 * @type {string}
	 */
	validateBy: string;

	/**
	 * WebAuthn credential request options returned when the challenge requires a public-key assertion.
	 *
	 * @type {PublicKeyCredentialRequestOptionsJSON}
	 */
	credentialOptions?: PublicKeyCredentialRequestOptionsJSON;
};

export type ApplicationLauncher = {
	/**
	 * Display name of the application.
	 *
	 * @type {string}
	 */
	name: string;

	/**
	 * URL used to initiate a login flow for the application.
	 *
	 * @type {string}
	 */
	loginUrl: string;

	/**
	 * URL to the application's logo image.
	 *
	 * @type {string}
	 */
	logoUrl?: string;
};

export type MyAccountAPIParams<
	T extends ((params: any) => unknown) | readonly ((params: any) => unknown)[] = (params: { token: string; options: unknown }) => unknown,
	ExtraParams = unknown,
> = (T extends readonly ((params: any) => unknown)[]
	? UnionToIntersection<{ [K in keyof T]: Omit<Parameters<Extract<T[K], (params: any) => unknown>>[0], 'token' | 'options'> }[number]>
	: T extends (params: any) => unknown
		? Omit<Parameters<T>[0], 'token' | 'options'>
		: never) &
	ExtraParams;

export type MyAccountAPI<ExtraParams = unknown> = {
	/**
	 * Fetches the enabled identifiers and linked identities of the authenticated user.
	 */
	fetchIdentifiers(params?: MyAccountAPIParams<[typeof myaccountAPI.fetchEnabledIdentifiers, typeof myaccountAPI.fetchIdentities], ExtraParams>): Promise<{
		attributes: HttpClientData<typeof myaccountAPI.fetchEnabledIdentifiers>;
		data: HttpClientData<typeof myaccountAPI.fetchIdentities>;
	}>;

	/**
	 * Sends an identifier update challenge request for the authenticated user.
	 * For username updates the identifier is changed immediately.
	 * For email and phone updates a passcode is sent and the passcode length is returned.
	 *
	 */
	sendIdentifierUpdateChallenge(
		params?: MyAccountAPIParams<typeof myaccountAPI.sendIdentifierUpdateChallenge, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.sendIdentifierUpdateChallenge>>;

	/**
	 * Updates the identifier of the authenticated user.
	 * Prerequisite: The identifier update challenge must be completed before calling this function.
	 */
	updateIdentifier(
		params?: MyAccountAPIParams<typeof myaccountAPI.updateIdentifier, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.updateIdentifier>>;

	/**
	 * Unlinks an external identity from the authenticated user's account.
	 */
	unlinkExternalIdentifier(
		params?: MyAccountAPIParams<typeof myaccountAPI.unlinkExternalIdentifier, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.unlinkExternalIdentifier>>;

	/**
	 * Fetches the supported authenticators of the authenticated user.
	 */
	fetchSupportedAuthenticators(
		params?: MyAccountAPIParams<typeof myaccountAPI.fetchSupportedAuthenticators, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.fetchSupportedAuthenticators>>;

	/**
	 * Fetches the registered authenticators of the authenticated user.
	 */
	fetchAuthenticators(
		params?: MyAccountAPIParams<typeof myaccountAPI.fetchAuthenticators, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.fetchAuthenticators>>;

	/**
	 * Fetches the soft token authenticator URI for the authenticated user.
	 */
	fetchSoftTokenAuthenticatorURI(
		params?: MyAccountAPIParams<typeof myaccountAPI.fetchSoftTokenAuthenticatorURI, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.fetchSoftTokenAuthenticatorURI>>;

	/**
	 * Sends an authenticator creation challenge request.
	 */
	sendAuthenticatorCreationChallenge(
		params?: MyAccountAPIParams<typeof myaccountAPI.sendAuthenticatorCreationChallenge, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.sendAuthenticatorCreationChallenge>>;

	/**
	 * Sends a passkey creation challenge request.
	 */
	sendPasskeyCreationChallenge(
		params?: MyAccountAPIParams<typeof myaccountAPI.sendPasskeyCreationChallenge, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.sendPasskeyCreationChallenge>>;

	/**
	 * Sends an authenticator deletion challenge request.
	 * Prerequisite: The authenticator deletion challenge must be completed before calling the deleteAuthenticator function.
	 */
	sendAuthenticatorDeletionChallenge(
		params?: MyAccountAPIParams<typeof myaccountAPI.sendAuthenticatorDeletionChallenge, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.sendAuthenticatorDeletionChallenge>>;

	/**
	 * Sends a passkey deletion challenge request.
	 * Prerequisite: The passkey deletion challenge must be completed before calling the deletePasskey function.
	 */
	sendPasskeyDeletionChallenge(
		params?: MyAccountAPIParams<typeof myaccountAPI.sendPasskeyDeletionChallenge, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.sendPasskeyDeletionChallenge>>;

	/**
	 * Creates an authenticator after the creation challenge has been completed.
	 * Prerequisite: The authenticator creation challenge must be completed before calling this function.
	 */
	createAuthenticator(
		params?: MyAccountAPIParams<typeof myaccountAPI.createAuthenticator, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.createAuthenticator>>;

	/**
	 * Creates a passkey after the creation challenge has been completed.
	 * Prerequisite: The passkey creation challenge must be completed before calling this function.
	 */
	createPasskey(params?: MyAccountAPIParams<typeof myaccountAPI.createPasskey, ExtraParams>): Promise<HttpClientData<typeof myaccountAPI.createPasskey>>;

	/**
	 * Updates the delivery methods of a registered authenticator.
	 */
	updateAuthenticatorMethod(
		params?: MyAccountAPIParams<typeof myaccountAPI.updateAuthenticatorMethod, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.updateAuthenticatorMethod>>;

	/**
	 * Deletes an authenticator after the deletion challenge has been completed.
	 */
	deleteAuthenticator(
		params?: MyAccountAPIParams<typeof myaccountAPI.deleteAuthenticator, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.deleteAuthenticator>>;

	/**
	 * Deletes a passkey after the deletion challenge has been completed.
	 */
	deletePasskey(params?: MyAccountAPIParams<typeof myaccountAPI.deletePasskey, ExtraParams>): Promise<HttpClientData<typeof myaccountAPI.deletePasskey>>;

	/**
	 * Fetches the attributes and personal data of the authenticated user.
	 */
	fetchAccountData(params?: MyAccountAPIParams<[typeof myaccountAPI.fetchAttributes, typeof myaccountAPI.fetchAccountData], ExtraParams>): Promise<{
		attributes: HttpClientData<typeof myaccountAPI.fetchAttributes>;
		data: HttpClientData<typeof myaccountAPI.fetchAccountData>;
	}>;

	/**
	 * Updates the personal data of the authenticated user.
	 */
	updateAccountData(
		params?: MyAccountAPIParams<typeof myaccountAPI.updateAccountData, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.updateAccountData>>;

	/**
	 * Fetches the account data export of the authenticated user as a binary blob.
	 */
	downloadAccountData(
		params?: MyAccountAPIParams<typeof myaccountAPI.downloadAccountData, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.downloadAccountData>>;

	/**
	 * Fetches the account information of the authenticated user.
	 */
	fetchAccountInfo(
		params?: MyAccountAPIParams<typeof myaccountAPI.fetchAccountInfo, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.fetchAccountInfo>>;

	/**
	 * Deletes the account of the authenticated user.
	 */
	deleteAccount(params?: MyAccountAPIParams<typeof myaccountAPI.deleteAccount, ExtraParams>): Promise<HttpClientData<typeof myaccountAPI.deleteAccount>>;

	/**
	 * Fetches the application launchers of the authenticated user.
	 */
	fetchApplicationLaunchers(
		params?: MyAccountAPIParams<typeof myaccountAPI.fetchApplicationLaunchers, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.fetchApplicationLaunchers>>;

	/**
	 * Fetches the password policy of the authenticated user.
	 */
	fetchPasswordPolicy(
		params?: MyAccountAPIParams<typeof myaccountAPI.fetchPasswordPolicy, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.fetchPasswordPolicy>>;

	/**
	 * Changes the password of the authenticated user.
	 */
	changePassword(params?: MyAccountAPIParams<typeof myaccountAPI.changePassword, ExtraParams>): Promise<HttpClientData<typeof myaccountAPI.changePassword>>;

	/**
	 * Fetches the notification preference descriptor and current preferences of the authenticated user.
	 */
	fetchNotificationPreferences(
		params?: MyAccountAPIParams<[typeof myaccountAPI.fetchNotificationPreferenceDescriptor, typeof myaccountAPI.fetchNotificationPreferences], ExtraParams>,
	): Promise<{
		descriptor: HttpClientData<typeof myaccountAPI.fetchNotificationPreferenceDescriptor>;
		preferences: HttpClientData<typeof myaccountAPI.fetchNotificationPreferences>;
	}>;

	/**
	 * Updates the notification preferences of the authenticated user.
	 */
	updateNotificationPreferences(
		params?: MyAccountAPIParams<typeof myaccountAPI.updateNotificationPreferences, ExtraParams>,
	): Promise<HttpClientData<typeof myaccountAPI.updateNotificationPreferences>>;

	/**
	 * Fetches the active sessions of the authenticated user.
	 */
	fetchSessions(params?: MyAccountAPIParams<typeof myaccountAPI.fetchSessions, ExtraParams>): Promise<HttpClientData<typeof myaccountAPI.fetchSessions>>;

	/**
	 * Deletes a specific session of the authenticated user.
	 */
	deleteSession(params?: MyAccountAPIParams<typeof myaccountAPI.deleteSession, ExtraParams>): Promise<HttpClientData<typeof myaccountAPI.deleteSession>>;

	/**
	 * Fetches the consents of the authenticated user.
	 */
	fetchConsents(params?: MyAccountAPIParams<typeof myaccountAPI.fetchConsents, ExtraParams>): Promise<HttpClientData<typeof myaccountAPI.fetchConsents>>;

	/**
	 * Opts the authenticated user into a specific consent.
	 */
	optInConsent(params?: MyAccountAPIParams<typeof myaccountAPI.optInConsent, ExtraParams>): Promise<HttpClientData<typeof myaccountAPI.optInConsent>>;

	/**
	 * Opts the authenticated user out of a specific consent.
	 */
	optOutConsent(params?: MyAccountAPIParams<typeof myaccountAPI.optOutConsent, ExtraParams>): Promise<HttpClientData<typeof myaccountAPI.optOutConsent>>;
};
