import { decodeBase64URL, encodeBase64URL } from './base64url';
import { ProtocolError } from './errors';

/**
 * Parses the provided PublicKeyCredentialCreationOptionsJSON into a PublicKeyCredentialCreationOptions object.
 *
 * @param {PublicKeyCredentialCreationOptionsJSON} credentialOptionsJSON - The creation options in JSON format.
 * @returns {PublicKeyCredentialCreationOptions} The parsed creation options.
 */
function parseCreationOptionsFromJSON(credentialOptionsJSON: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
	const user = {
		...credentialOptionsJSON.user,
		id: decodeBase64URL(credentialOptionsJSON.user.id),
	} as PublicKeyCredentialUserEntity;
	const challenge = decodeBase64URL(credentialOptionsJSON.challenge);
	const excludeCredentials =
		credentialOptionsJSON.excludeCredentials?.map((cred) => {
			return {
				...cred,
				id: decodeBase64URL(cred.id),
				transports: cred.transports as AuthenticatorTransport[] | undefined,
			} as PublicKeyCredentialDescriptor;
		}) ?? [];

	return {
		...credentialOptionsJSON,
		user,
		challenge,
		excludeCredentials,
	} as PublicKeyCredentialCreationOptions;
}

/**
 * Parses the provided PublicKeyCredentialRequestOptionsJSON into a PublicKeyCredentialRequestOptions object.
 *
 * @param {PublicKeyCredentialRequestOptionsJSON} options - The request options in JSON format.
 * @returns {PublicKeyCredentialRequestOptions} The parsed request options.
 */
function parseRequestOptionsFromJSON(options: PublicKeyCredentialRequestOptionsJSON): PublicKeyCredentialRequestOptions {
	const challenge = decodeBase64URL(options.challenge);
	const allowCredentials =
		options.allowCredentials?.map((cred) => {
			return {
				...cred,
				id: decodeBase64URL(cred.id),
				transports: cred.transports as AuthenticatorTransport[] | undefined,
			} as PublicKeyCredentialDescriptor;
		}) ?? [];

	return {
		...options,
		allowCredentials,
		challenge,
	} as PublicKeyCredentialRequestOptions;
}

/**
 * Creates a new WebAuthn credential using the browser's credential manager.
 *
 * @param {PublicKeyCredentialCreationOptionsJSON} creationOptions - The options for creating a new credential, in JSON format.
 * @param {AbortController} [abortController] - An optional AbortController to allow cancellation of the request.
 * @returns {Promise<RegistrationResponseJSON>} A promise that resolves to the registration response in JSON format.
 * @throws {Error} Throws an error if the created credential is not of type 'public-key'.
 */
export async function createWebAuthnCredential(
	creationOptions: PublicKeyCredentialCreationOptionsJSON,
	abortController: AbortController = new AbortController(),
): Promise<RegistrationResponseJSON> {
	const credential = (await navigator.credentials.create({
		publicKey: parseCreationOptionsFromJSON(creationOptions),
		signal: abortController.signal,
	})) as PublicKeyCredential;
	const credentialResponse = credential.response as AuthenticatorAttestationResponse;

	if (credential.type !== 'public-key') {
		throw new ProtocolError('Not a public key');
	}

	return {
		id: credential.id,
		rawId: encodeBase64URL(credential.rawId),
		response: {
			clientDataJSON: encodeBase64URL(credentialResponse.clientDataJSON),
			attestationObject: encodeBase64URL(credentialResponse.attestationObject),
			transports: credentialResponse.getTransports?.() ?? [],
		} as AuthenticatorAttestationResponseJSON,
		authenticatorAttachment: credential.authenticatorAttachment,
		clientExtensionResults: credential.getClientExtensionResults(),
		type: credential.type,
	} as RegistrationResponseJSON;
}

/**
 * Retrieves and asserts an existing WebAuthn credential using the browser's credential manager.
 *
 * @param {PublicKeyCredentialRequestOptionsJSON} requestOptions - The options for requesting a credential, in JSON format.
 * @param {CredentialMediationRequirement} [mediation='optional'] - The mediation requirement for the credential request.
 * @param {AbortController} [abortController] - An optional AbortController to allow cancellation of the request.
 * @returns {Promise<AuthenticationResponseJSON>} A promise that resolves to the authentication response in JSON format.
 * @throws An error if the retrieved credential is not of type 'public-key'.
 */
export async function assertWebAuthnCredential(
	requestOptions: PublicKeyCredentialRequestOptionsJSON,
	mediation: CredentialMediationRequirement = 'optional',
	abortController: AbortController = new AbortController(),
): Promise<AuthenticationResponseJSON> {
	const credential = (await navigator.credentials.get({
		publicKey: parseRequestOptionsFromJSON(requestOptions),
		mediation: mediation,
		signal: abortController.signal,
	})) as PublicKeyCredential;

	if (credential.type !== 'public-key') {
		throw new ProtocolError('Not a public key');
	}

	return credential.toJSON() as AuthenticationResponseJSON;
}
