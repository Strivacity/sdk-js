import type { AssertionCredentialData, AssertionPublicKeyCredential, AttestationCredentialData, AttestationPublicKeyCredential } from '../types';
import { Base64Url } from './base64Url';

export async function createCredential(credentialOptions: PublicKeyCredentialCreationOptions): Promise<AttestationCredentialData> {
	credentialOptions.challenge = Base64Url.decode(credentialOptions.challenge);
	credentialOptions.user.id = Base64Url.decode(credentialOptions.user.id);

	if (credentialOptions.excludeCredentials) {
		credentialOptions.excludeCredentials = credentialOptions.excludeCredentials.map((excludeCredential: PublicKeyCredentialDescriptor) => {
			excludeCredential.id = Base64Url.decode(excludeCredential.id);
			return excludeCredential;
		});
	}

	const credentialsController = new AbortController();
	const credential = (await navigator.credentials.create({
		publicKey: credentialOptions,
		signal: credentialsController.signal,
	})) as AttestationPublicKeyCredential;

	if (credential.type !== 'public-key') {
		return Promise.reject(new Error('Not a public key'));
	}

	return {
		id: credential.id,
		rawId: Base64Url.encode(credential.rawId),
		type: credential.type,
		authenticatorAttachment: credential.authenticatorAttachment,
		response: {
			clientDataJSON: Base64Url.encode(credential.response.clientDataJSON),
			attestationObject: Base64Url.encode(credential.response.attestationObject),
			transports: credential.response.getTransports ? credential.response.getTransports() : [],
		},
	};
}

export async function getCredential(credentialOptions: PublicKeyCredentialRequestOptions, conditional = false): Promise<AssertionCredentialData> {
	credentialOptions.challenge = Base64Url.decode(credentialOptions.challenge);

	if (credentialOptions.allowCredentials) {
		credentialOptions.allowCredentials = credentialOptions.allowCredentials?.map((allowCredential: PublicKeyCredentialDescriptor) => {
			allowCredential.id = Base64Url.decode(allowCredential.id);
			return allowCredential;
		});
	}

	const credentialsController = new AbortController();
	const credential = (await navigator.credentials.get({
		publicKey: credentialOptions,
		signal: credentialsController.signal,
		mediation: conditional ? 'conditional' : 'optional',
	})) as AssertionPublicKeyCredential;

	if (credential.type !== 'public-key') {
		return Promise.reject(new Error('Not a public key'));
	}

	return {
		id: credential.id,
		rawId: Base64Url.encode(credential.rawId),
		type: credential.type,
		response: {
			clientDataJSON: Base64Url.encode(credential.response.clientDataJSON),
			authenticatorData: Base64Url.encode(credential.response.authenticatorData),
			signature: Base64Url.encode(credential.response.signature),
			userHandle: Base64Url.encode(credential.response.userHandle),
		},
	};
}
