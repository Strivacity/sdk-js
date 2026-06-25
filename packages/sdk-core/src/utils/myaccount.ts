import type { HttpClientResponse } from '../types/common';
import type { SDKOptions } from '../types/oidc';
import type {
	Identities,
	Identifier,
	IdentifierType,
	Authenticator,
	SupportedAuthenticators,
	AuthenticatorMethodType,
	DeleteAuthenticatorChallengeResponse,
	Attribute,
	AccountData,
	DeviceData,
	ConsentData,
	NotificationPreferenceDescriptor,
	NotificationPreferences,
	PasswordPolicy,
} from '../types/myaccount';

/**
 * Fetches the enabled identifiers of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {string} params.language - BCP 47 language tag for the response locale (e.g. `'en-US'`).
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Array<Identifier>>>} The enabled identifiers of the authenticated user.
 */
export async function fetchEnabledIdentifiers({
	token,
	language = 'en-US',
	options,
}: {
	token: string;
	language?: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<Array<Identifier>>> {
	return await options.httpClient.request<Array<Identifier>>(new URL('/myaccount/api/v1/enabledIdentifiers', options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Accept-language': language,
		},
	});
}

/**
 * Fetches the identities of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Identities>>} The identities of the authenticated user.
 */
export async function fetchIdentities({ token, options }: { token: string; options: SDKOptions }): Promise<HttpClientResponse<Identities>> {
	return await options.httpClient.request<Identities>(new URL('/myaccount/api/v1/identities', options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * Sends an identifier update challenge request for the authenticated user to the My Account API.
 * For username updates the identifier is changed immediately and returns the updated identities.
 * For email and phone updates a passcode is sent and the passcode length is returned.
 *
 * @param {Object} params
 * @param {IdentifierType} params.type - The type of identifier to update.
 * @param {string} params.identifier - The new identifier value.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {string} params.language - BCP 47 language tag for the response locale (e.g. `'en-US'`).
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Identities | { passcodeLength: number }>>} The updated identities or the passcode length.
 */
export async function sendIdentifierUpdateChallenge({
	type,
	identifier,
	token,
	language = 'en-US',
	options,
}: {
	type: IdentifierType;
	identifier: string;
	token: string;
	language?: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<Identities | { passcodeLength: number }>> {
	return await options.httpClient.request<Identities | { passcodeLength: number }>(new URL('/myaccount/api/v1/identifier', options.issuer), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Accept-language': language,
		},
		body: JSON.stringify({
			type,
			identifier,
		}),
	});
}

/**
 * Updates the identifier of the authenticated user in the My Account API.
 * Prerequisite: The identifier update challenge must be completed before calling this function.
 *
 * @param {Object} params
 * @param {IdentifierType} params.type - The type of identifier to update.
 * @param {string} params.identifier - The new identifier value.
 * @param {string} params.challenge - The passcode used to validate the update request.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<void>>} The response from the identifier update request.
 */
export async function updateIdentifier({
	type,
	identifier,
	challenge,
	token,
	options,
}: {
	type: IdentifierType;
	identifier: string;
	challenge: string;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<void>> {
	return await options.httpClient.request<void>(new URL('/myaccount/api/v1/identifier', options.issuer), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'X-Challenge': challenge,
		},
		body: JSON.stringify({
			type,
			identifier,
		}),
	});
}

/**
 * Unlinks an external identity from the authenticated user's account in the My Account API.
 *
 * @param {Object} params
 * @param {string} params.id - The ID of the external identity to unlink.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<void>>} The response from the unlink request.
 */
export async function unlinkExternalIdentifier({ id, token, options }: { id: string; token: string; options: SDKOptions }): Promise<HttpClientResponse<void>> {
	return await options.httpClient.request<void>(new URL(`/myaccount/api/v1/identities/${id}`, options.issuer), {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * Fetches the supported authenticators of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<SupportedAuthenticators>>} The supported authenticators of the authenticated user.
 */
export async function fetchSupportedAuthenticators({
	token,
	options,
}: {
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<SupportedAuthenticators>> {
	return await options.httpClient.request<SupportedAuthenticators>(new URL('/myaccount/api/v1/authenticators/supported', options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * Fetches the authenticators of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Array<Authenticator>>>} The list of authenticators for the authenticated user.
 */
export async function fetchAuthenticators({ token, options }: { token: string; options: SDKOptions }): Promise<HttpClientResponse<Array<Authenticator>>> {
	return await options.httpClient.request<Array<Authenticator>>(new URL('/myaccount/api/v1/authenticators', options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * Fetches the soft token authenticator URI for the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<{ uri: string }>>} The soft token authenticator URI for the authenticated user.
 */
export async function fetchSoftTokenAuthenticatorURI({ token, options }: { token: string; options: SDKOptions }): Promise<HttpClientResponse<{ uri: string }>> {
	return await options.httpClient.request<{ uri: string }>(new URL('/myaccount/api/v1/authenticators', options.issuer), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			target: crypto.randomUUID(),
			type: 'softToken',
		}),
	});
}

/**
 * Sends an authenticator creation challenge request for the authenticated user to the My Account API.
 *
 * @param {Object} params
 * @param {string} params.target - The target of the authenticator challenge (e.g. email address or phone number).
 * @param {AuthenticatorMethodType} params.type - The type of authenticator challenge to fetch.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {string} params.language - BCP 47 language tag for the response locale (e.g. `'en-US'`).
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<void>>} The response from the authenticator challenge request.
 */
export async function sendAuthenticatorCreationChallenge({
	target,
	type,
	token,
	language = 'en-US',
	options,
}: {
	target: string;
	type: AuthenticatorMethodType;
	token: string;
	language?: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<void>> {
	return await options.httpClient.request<void>(new URL('/myaccount/api/v1/authenticators', options.issuer), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Accept-language': language,
		},
		body: JSON.stringify({
			target,
			type,
		}),
	});
}

/**
 * Sends a passkey creation challenge request for the authenticated user to the My Account API.
 *
 * @param {Object} params
 * @param {string} params.target - The target of the authenticator challenge (e.g. email address or phone number).
 * @param {AuthenticatorMethodType} params.type - The type of authenticator challenge to fetch.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {string} params.language - BCP 47 language tag for the response locale (e.g. `'en-US'`).
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<void>>} The response from the authenticator challenge request.
 */
export async function sendPasskeyCreationChallenge({
	target,
	type,
	token,
	language = 'en-US',
	options,
}: {
	target: string;
	type: AuthenticatorMethodType;
	token: string;
	language?: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<PublicKeyCredentialCreationOptionsJSON>> {
	return await options.httpClient.request<PublicKeyCredentialCreationOptionsJSON>(new URL('/myaccount/api/v1/authenticators', options.issuer), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Accept-language': language,
		},
		body: JSON.stringify({
			target,
			type,
		}),
	});
}

/**
 * Sends an authenticator deletion challenge request for the authenticated user to the My Account API.
 *
 * @param {Object} params
 * @param {string} params.id - The ID of the authenticator to delete.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {string} params.language - BCP 47 language tag for the response locale (e.g. `'en-US'`).
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<DeleteAuthenticatorChallengeResponse>>} The response from the authenticator deletion challenge request.
 */
export async function sendAuthenticatorDeletionChallenge({
	id,
	token,
	language = 'en-US',
	options,
}: {
	id: string;
	token: string;
	language?: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<DeleteAuthenticatorChallengeResponse>> {
	return await options.httpClient.request<DeleteAuthenticatorChallengeResponse>(new URL(`/myaccount/api/v1/authenticators/${id}`, options.issuer), {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
			'Accept-language': language,
		},
	});
}

/**
 * Sends a passkey deletion challenge request for the authenticated user to the My Account API.
 *
 * @param {Object} params
 * @param {string} params.id - The ID of the authenticator to delete.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {string} params.language - BCP 47 language tag for the response locale (e.g. `'en-US'`).
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<DeleteAuthenticatorChallengeResponse>>} The response from the authenticator deletion challenge request.
 */
export async function sendPasskeyDeletionChallenge(
	params: Parameters<typeof sendAuthenticatorDeletionChallenge>[0],
): Promise<HttpClientResponse<DeleteAuthenticatorChallengeResponse>> {
	return sendAuthenticatorDeletionChallenge(params);
}

/**
 * Creates an authenticator for the authenticated user in the My Account API.
 * Prerequisite: The authenticator creation challenge must be completed before calling this function.
 *
 * @param {Object} params
 * @param {string} params.target - The target of the authenticator (e.g. email address or phone number).
 * @param {AuthenticatorMethodType} params.type - The type of authenticator to create.
 * @param {string} params.challenge - The challenge used to validate the creation request.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Authenticator>>} The created authenticator.
 */
export async function createAuthenticator({
	target,
	type,
	challenge,
	token,
	options,
}: {
	target: string;
	type: AuthenticatorMethodType;
	challenge: string;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<Authenticator>> {
	return await options.httpClient.request<Authenticator>(new URL('/myaccount/api/v1/authenticators', options.issuer), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'X-Challenge': challenge,
		},
		body: JSON.stringify({
			target,
			type,
		}),
	});
}

/**
 * Creates a passkey for the authenticated user in the My Account API.
 * Prerequisite: The passkey creation challenge must be completed before calling this function.
 *
 * @param {Object} params
 * @param {string} params.target - The target of the passkey.
 * @param {AuthenticatorMethodType} params.type - The type of passkey to create.
 * @param {Record<string, unknown>} params.challenge - The WebAuthn attestation credential data used to validate the creation request.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Authenticator>>} The created passkey authenticator.
 */
export async function createPasskey({
	target,
	type,
	challenge,
	token,
	options,
}: {
	target: string;
	type: AuthenticatorMethodType;
	challenge: Record<string, unknown>;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<Authenticator>> {
	return createAuthenticator({
		target,
		type,
		challenge: JSON.stringify(challenge),
		token,
		options,
	});
}

/**
 * Updates the methods of an authenticator for the authenticated user in the My Account API.
 *
 * @param {Object} params
 * @param {string} params.id - The ID of the authenticator to update.
 * @param {Array<'magicLink' | 'passcode' | 'voice'>} params.methods - The updated methods to set for the authenticator.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<void>>} The response from the authenticator update request.
 */
export async function updateAuthenticatorMethod({
	id,
	methods,
	token,
	options,
}: {
	id: string;
	methods: Array<'magicLink' | 'passcode' | 'voice'>;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<void>> {
	return await options.httpClient.request<void>(new URL(`/myaccount/api/v1/authenticators/${id}`, options.issuer), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			methods,
		}),
	});
}

/**
 * Deletes an authenticator for the authenticated user from the My Account API.
 * Prerequisite: The authenticator deletion challenge must be completed before calling this function.
 *
 * @param {Object} params
 * @param {string} params.id - The ID of the authenticator to delete.
 * @param {string} params.challenge - The challenge used to validate the deletion request.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<void>>} The response from the authenticator deletion request.
 */
export async function deleteAuthenticator({
	id,
	challenge,
	token,
	options,
}: {
	id: string;
	challenge: string;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<void>> {
	return await options.httpClient.request<void>(new URL(`/myaccount/api/v1/authenticators/${id}`, options.issuer), {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
			'X-Challenge': challenge,
		},
	});
}

/**
 * Deletes a passkey for the authenticated user from the My Account API.
 * Prerequisite: The passkey deletion challenge must be completed before calling this function.
 *
 * @param {Object} params
 * @param {string} params.id - The ID of the passkey to delete.
 * @param {PublicKeyCredentialRequestOptionsJSON} params.challenge - The challenge used to validate the deletion request.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<void>>} The response from the passkey deletion request.
 */
export async function deletePasskey({
	id,
	challenge,
	token,
	options,
}: {
	id: string;
	challenge: PublicKeyCredentialRequestOptionsJSON;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<void>> {
	return deleteAuthenticator({
		id,
		challenge: JSON.stringify(challenge),
		token,
		options,
	});
}

/**
 * Fetches the attributes of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {string} params.language - BCP 47 language tag for the response locale (e.g. `'en-US'`).
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Array<Attribute>>>} The list of attributes for the authenticated user.
 */
export async function fetchAttributes({
	token,
	language = 'en-US',
	options,
}: {
	token: string;
	language?: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<Array<Attribute>>> {
	return await options.httpClient.request<Array<Attribute>>(new URL('/myaccount/api/v1/attributes', options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Accept-language': language,
		},
	});
}

/**
 * Fetches the personal data of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<AccountData>>} The personal data of the authenticated user.
 */
export async function fetchAccountData({ token, options }: { token: string; options: SDKOptions }): Promise<HttpClientResponse<AccountData>> {
	return await options.httpClient.request<AccountData>(new URL('/myaccount/api/v1/personal', options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * Updates the personal data of the authenticated user in the My Account API.
 *
 * @param {Object} params
 * @param {AccountData} params.data - The updated personal data to set for the authenticated user.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<AccountData>>} The updated personal data of the authenticated user.
 */
export async function updateAccountData({
	data,
	token,
	options,
}: {
	data: AccountData;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<AccountData>> {
	return await options.httpClient.request<AccountData>(new URL('/myaccount/api/v1/personal', options.issuer), {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(data),
	});
}

/**
 * Fetches the account data export of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {'JSON' | 'HTML'} params.fileType - The file format of the export.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {string} params.language - BCP 47 language tag for the response locale (e.g. `'en-US'`).
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Blob>>} The exported account data as a binary response.
 */
export async function downloadAccountData({
	fileType,
	token,
	language = 'en-US',
	options,
}: {
	fileType: 'JSON' | 'HTML';
	token: string;
	language?: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<Blob>> {
	return await options.httpClient.request<Blob>(new URL(`/myaccount/api/v1/me/personalData?fileType=${fileType}`, options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Accept-language': language,
		},
	});
}

/**
 * Deletes the account of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * sendAuthenticatorDeletionChallenge
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<void>>} The response from the account deletion request.
 */
export async function deleteAccount({
	token,
	language = 'en-US',
	options,
}: {
	token: string;
	language?: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<void>> {
	return await options.httpClient.request<void>(new URL('/myaccount/api/v1/remove', options.issuer), {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
			'Accept-language': language,
		},
	});
}

/**
 * Fetches the password policy of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<PasswordPolicy>>} The password policy of the authenticated user.
 */
export async function fetchPasswordPolicy({ token, options }: { token: string; options: SDKOptions }): Promise<HttpClientResponse<PasswordPolicy>> {
	return await options.httpClient.request<PasswordPolicy>(new URL('/myaccount/api/v1/password', options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * Changes the password of the authenticated user in the My Account API.
 *
 * @param {Object} params
 * @param {string} params.currentPassword - The current password of the authenticated user.
 * @param {string} params.newPassword - The new password to set for the authenticated user.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<void>>} The response from the password change request.
 */
export async function changePassword({
	currentPassword,
	newPassword,
	token,
	options,
}: {
	currentPassword: string;
	newPassword: string;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<void>> {
	return await options.httpClient.request<void>(new URL('/myaccount/api/v1/password', options.issuer), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			currentPassword: currentPassword,
			newPassword: newPassword,
		}),
	});
}

/**
 * Fetches the notification preference descriptor of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {string} params.language - BCP 47 language tag for the response locale (e.g. `'en-US'`).
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Array<NotificationPreferenceDescriptor>>>} The notification preference descriptor of the authenticated user.
 */
export async function fetchNotificationPreferenceDescriptor({
	token,
	language = 'en-US',
	options,
}: {
	token: string;
	language?: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<Array<NotificationPreferenceDescriptor>>> {
	return await options.httpClient.request<Array<NotificationPreferenceDescriptor>>(
		new URL('/myaccount/api/v1/notificationPreferences/descriptor', options.issuer),
		{
			method: 'GET',
			headers: {
				Authorization: `Bearer ${token}`,
				'Accept-language': language,
			},
		},
	);
}

/**
 * Fetches the notification preferences of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<NotificationPreferences>>} The notification preferences of the authenticated user.
 */
export async function fetchNotificationPreferences({
	token,
	options,
}: {
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<NotificationPreferences>> {
	return await options.httpClient.request<NotificationPreferences>(new URL('/myaccount/api/v1/notificationPreferences', options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * Updates the notification preferences of the authenticated user in the My Account API.
 *
 * @param {Object} params
 * @param {NotificationPreferences} params.preferences - The updated notification preferences to set for the authenticated user.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<NotificationPreferences>>} The updated notification preferences of the authenticated user.
 */
export async function updateNotificationPreferences({
	preferences,
	token,
	options,
}: {
	preferences: NotificationPreferences;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<NotificationPreferences>> {
	return await options.httpClient.request<NotificationPreferences>(new URL('/myaccount/api/v1/notificationPreferences', options.issuer), {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(preferences),
	});
}

/**
 * Fetches the sessions of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Array<DeviceData>>>} The list of sessions for the authenticated user.
 */
export async function fetchSessions({ token, options }: { token: string; options: SDKOptions }): Promise<HttpClientResponse<Array<DeviceData>>> {
	return await options.httpClient.request<Array<DeviceData>>(new URL('/myaccount/api/v1/sessions', options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * Deletes a specific session of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.sessionId - The ID of the session to delete.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Array<DeviceData>>>} The list of remaining sessions for the authenticated user.
 */
export async function deleteSession({
	sessionId,
	token,
	options,
}: {
	sessionId: string;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<Array<DeviceData>>> {
	return await options.httpClient.request<Array<DeviceData>>(new URL(`/myaccount/api/v1/sessions/${sessionId}`, options.issuer), {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * Fetches the consents of the authenticated user from the My Account API.
 *
 * @param {Object} params
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {string} params.language - BCP 47 language tag for the response locale (e.g. `'en-US'`).
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<Array<ConsentData>>>} The consents of the authenticated user.
 */
export async function fetchConsents({
	token,
	language = 'en-US',
	options,
}: {
	token: string;
	language?: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<Array<ConsentData>>> {
	return await options.httpClient.request<Array<ConsentData>>(new URL('/myaccount/api/v1/consents', options.issuer), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Accept-language': language,
		},
	});
}

/**
 * Opts the authenticated user into a specific consent in the My Account API.
 *
 * @param {Object} params
 * @param {string} params.consentId - The ID of the consent to opt-in.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<ConsentData>>} The response from the consent update request.
 */
export async function optInConsent({
	consentId,
	token,
	options,
}: {
	consentId: string;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<ConsentData>> {
	return await options.httpClient.request<ConsentData>(new URL(`/myaccount/api/v1/consents/${consentId}/optIn`, options.issuer), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * Opts the authenticated user out of a specific consent in the My Account API.
 *
 * @param {Object} params
 * @param {string} params.consentId - The ID of the consent to opt-out.
 * @param {string} params.receiptId - The ID of the consent receipt to opt-out.
 * @param {string} params.token - Bearer access token for the authenticated user.
 * @param {SDKOptions} params.options - SDK options (used to derive the default endpoint from the issuer).
 * @returns {Promise<HttpClientResponse<ConsentData>>} The response from the consent update request.
 */
export async function optOutConsent({
	consentId,
	receiptId,
	token,
	options,
}: {
	consentId: string;
	receiptId: string;
	token: string;
	options: SDKOptions;
}): Promise<HttpClientResponse<ConsentData>> {
	return await options.httpClient.request<ConsentData>(new URL(`/myaccount/api/v1/consents/${consentId}/optOut`, options.issuer), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			id: receiptId,
		}),
	});
}
