'use client';
import type {
	AssertionCredentialData,
	AssertionPublicKeyCredential,
	AttestationCredentialData,
	AttestationPublicKeyCredential,
	WebAuthnWidget,
} from '@strivacity/sdk-core';
import { Base64Url } from '@strivacity/sdk-core/utils/base64Url';
import { NativeFlowContext } from '@strivacity/sdk-next';
import { useContext, useMemo } from 'react';
import './webauthn.widget.scss';

export function WebAuthnWidget({ formId, config }: { formId: string; config: WebAuthnWidget }) {
	const context = useContext(NativeFlowContext);
	const disabled = useMemo(() => !!context?.loading, [context?.loading]);
	let credentialsController: AbortController | null = null;

	async function createCredential(credentialOptions: PublicKeyCredentialCreationOptions): Promise<AttestationCredentialData> {
		credentialOptions.challenge = Base64Url.decode(credentialOptions.challenge);
		credentialOptions.user.id = Base64Url.decode(credentialOptions.user.id);

		if (credentialOptions.excludeCredentials) {
			credentialOptions.excludeCredentials = credentialOptions.excludeCredentials.map((excludeCredential: PublicKeyCredentialDescriptor) => {
				excludeCredential.id = Base64Url.decode(excludeCredential.id);
				return excludeCredential;
			});
		}

		credentialsController?.abort();
		credentialsController = new AbortController();

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

	async function readCredentials(credentialOptions: PublicKeyCredentialRequestOptions, conditional = false): Promise<AssertionCredentialData> {
		credentialOptions.challenge = Base64Url.decode(credentialOptions.challenge);

		if (credentialOptions.allowCredentials) {
			credentialOptions.allowCredentials = credentialOptions.allowCredentials.map((allowCredential: PublicKeyCredentialDescriptor) => {
				allowCredential.id = Base64Url.decode(allowCredential.id);
				return allowCredential;
			});
		}

		credentialsController?.abort();
		credentialsController = new AbortController();

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

	const onSubmit = async (event: React.SyntheticEvent) => {
		event.preventDefault();

		const metadata = config.metadata;

		if (disabled) {
			return;
		}

		if (!metadata) {
			return;
		}

		try {
			let response: AssertionCredentialData | AttestationCredentialData | null = null;

			if (metadata?.assertionOptions) {
				response = await readCredentials(metadata?.assertionOptions);
			} else if (metadata?.creationOptions) {
				response = await createCredential(metadata?.creationOptions);
			}

			if (!context?.forms[formId]) {
				context!.forms[formId] = {};
			}

			if (response) {
				context!.forms[formId][config.id] = response;
			}

			await context?.submitForm(formId);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			alert('Authentication failed. Please try again');
		}
	};

	return (
		<button
			disabled={disabled}
			data-type="button"
			data-widget="webauthn"
			data-form-id={formId}
			data-widget-id={config.id}
			onClick={(e) => void onSubmit(e)}
			style={{
				backgroundColor: config.render.bgColor ?? (config.render.hint?.variant === 'primary' ? `#5d21ab` : `#ffffff`),
				color: config.render.textColor ?? (config.render.hint?.variant === 'primary' ? `#ffffff` : `#5d21ab`),
			}}
			onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? void onSubmit(e) : undefined)}
		>
			{config.label}
		</button>
	);
}
