import { Base64URL } from './base64url';

/**
 * Parses the provided PublicKeyCredentialCreationOptionsJSON into a PublicKeyCredentialCreationOptions object.
 *
 * @param {PublicKeyCredentialCreationOptionsJSON} credentialOptionsJSON - The creation options in JSON format.
 * @returns {PublicKeyCredentialCreationOptions} The parsed creation options.
 */
function parseCreationOptionsFromJSON(credentialOptionsJSON: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
	const user = {
		...credentialOptionsJSON.user,
		id: Base64URL.decode(credentialOptionsJSON.user.id),
	} as PublicKeyCredentialUserEntity;
	const challenge = Base64URL.decode(credentialOptionsJSON.challenge);
	const excludeCredentials =
		credentialOptionsJSON.excludeCredentials?.map((cred) => {
			return {
				...cred,
				id: Base64URL.decode(cred.id),
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
	const challenge = Base64URL.decode(options.challenge);
	const allowCredentials =
		options.allowCredentials?.map((cred) => {
			return {
				...cred,
				id: Base64URL.decode(cred.id),
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
 * Creates a new credential using the browser's credential manager with the provided creation options.
 *
 * @param {PublicKeyCredentialCreationOptionsJSON} creationOptions - The options for creating a new credential, in JSON format.
 * @param {AbortController} [abortController] - An optional AbortController to allow cancellation of the request.
 * @returns {Promise<RegistrationResponseJSON>} A promise that resolves to the registration response in JSON format.
 * @throws {Error} Throws an error if the created credential is not of type 'public-key'.
 */
export async function createCredential(
	creationOptions: PublicKeyCredentialCreationOptionsJSON,
	abortController = new AbortController(),
): Promise<RegistrationResponseJSON> {
	const credential = (await navigator.credentials.create({
		publicKey: parseCreationOptionsFromJSON(creationOptions),
		signal: abortController.signal,
	})) as PublicKeyCredential;
	const credentialResponse = credential.response as AuthenticatorAttestationResponse;

	if (credential.type !== 'public-key') {
		throw new Error('Not a public key');
	}

	return {
		id: credential.id,
		rawId: Base64URL.encode(credential.rawId),
		response: {
			clientDataJSON: Base64URL.encode(credentialResponse.clientDataJSON),
			attestationObject: Base64URL.encode(credentialResponse.attestationObject),
			transports: credentialResponse.getTransports?.() ?? [],
		} as AuthenticatorAttestationResponseJSON,
		authenticatorAttachment: credential.authenticatorAttachment,
		clientExtensionResults: credential.getClientExtensionResults(),
		type: credential.type,
	} as RegistrationResponseJSON;
}

/**
 * Retrieves a credential from the browser's credential manager using the provided request options.
 *
 * @param requestOptions - The options for requesting a credential, in JSON format.
 * @param mediation - The mediation requirement for the credential request. Defaults to 'optional'.
 * @param abortController - An optional AbortController to allow cancellation of the request.
 * @returns A promise that resolves to the authentication response in JSON format.
 * @throws An error if the retrieved credential is not of type 'public-key'.
 */
export async function getCredential(
	requestOptions: PublicKeyCredentialRequestOptionsJSON,
	mediation: CredentialMediationRequirement = 'optional',
	abortController = new AbortController(),
): Promise<AuthenticationResponseJSON> {
	const credential = (await navigator.credentials.get({
		publicKey: parseRequestOptionsFromJSON(requestOptions),
		mediation: mediation,
		signal: abortController.signal,
	})) as PublicKeyCredential;

	if (credential.type !== 'public-key') {
		throw new Error('Not a public key');
	}

	return credential.toJSON() as AuthenticationResponseJSON;
}
