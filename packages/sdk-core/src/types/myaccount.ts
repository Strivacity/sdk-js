import type { PartialRecord } from './common';

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
	identifierType: 'email';
};

export type PhoneIdentifierAttribute = AttributeIdentifierBase & {
	identifierType: 'phone';
};

export type UsernameIdentifierAttribute = AttributeIdentifierBase & {
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
	type: 'checkbox';

	/**
	 * Default checked state when no value is set.
	 *
	 * @type {boolean}
	 */
	default?: boolean;
};

export type StringAttribute = AttributeNonIdentifierBase & {
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
	type: 'email';

	/**
	 * HTML autocomplete attribute hint.
	 *
	 * @type {string}
	 */
	autocomplete?: string;
};

export type SelectAttribute = AttributeNonIdentifierBase & {
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
	type: 'phoneNumber';
};

export type DateAttribute = AttributeNonIdentifierBase & {
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
	type: 'emailList';

	/**
	 * HTML autocomplete hint for each item input.
	 *
	 * @type {string}
	 */
	autocomplete?: string;
};

export type PhoneNumberListAttribute = AttributeListBase & {
	type: 'phoneNumberList';
};

export type SelectListAttribute = AttributeListBase & {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AccountData = Record<string, any>;

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

	// NOTE: UI only
	createdAtRelative?: string | null;
	createdAtFormatted?: string;
	lastUsedAtRelative?: string | null;
	lastUsedAtFormatted?: string;
};

export const PhaseTypeList = ['challenge', 'verify'] as const;
export type PhaseType = (typeof PhaseTypeList)[number];

export type SupportedAuthenticators = {
	email?: Array<'passcode' | 'magicLink'>;
	passkey?: Array<'publicKey'>;
	phone?: Array<'passcode' | 'voice' | 'magicLink'>;
	softToken?: Array<'passcode'>;
	webAuthnDeviceBiometrics?: Array<'publicKey'>;
	webAuthnSecurityKey?: Array<'publicKey'>;
};

export type DeleteAuthenticatorChallengeResponse = {
	validateBy: string;
	credentialOptions?: PublicKeyCredentialRequestOptionsJSON;
};
