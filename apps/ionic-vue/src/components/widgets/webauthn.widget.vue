<script lang="ts" setup>
import type {
	AssertionCredentialData,
	AssertionPublicKeyCredential,
	AttestationCredentialData,
	AttestationPublicKeyCredential,
	WebAuthnWidget,
} from '@strivacity/sdk-core';
import { Base64Url } from '@strivacity/sdk-core/utils/base64Url';
import type { NativeFlowContextValue } from '@strivacity/sdk-vue';
import { computed, inject } from 'vue';

const props = defineProps<{ formId: string; config: WebAuthnWidget }>();
const context = inject<NativeFlowContextValue>('nativeFlowContext');
const disabled = computed(() => !!context?.loading.value);

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
		credentialOptions.allowCredentials = credentialOptions.allowCredentials?.map((allowCredential: PublicKeyCredentialDescriptor) => {
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

async function onSubmit(event: Event) {
	event.preventDefault();

	if (disabled.value) {
		return;
	}

	const { formId, config } = props;
	const metadata = config.metadata;

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

		if (!context?.forms.value[formId]) {
			context!.forms.value[formId] = {};
		}

		if (response) {
			context!.forms.value[formId][config.id] = response;
		}

		await context!.submitForm(formId);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error(error);
		alert('Authentication failed. Please try again');
	}
}
</script>

<template>
	<button
		type="button"
		:disabled="disabled"
		data-type="button"
		data-widget="webauthn"
		:data-form-id="formId"
		:data-widget-id="config.id"
		:style="{
			backgroundColor: config.render.bgColor ?? (config.render.hint?.variant === 'primary' ? `#5d21ab` : `#ffffff`),
			color: config.render.textColor ?? (config.render.hint?.variant === 'primary' ? `#ffffff` : `#5d21ab`),
		}"
		@click.prevent="onSubmit($event)"
		@keydown.enter="onSubmit($event)"
		@keydown.space="onSubmit($event)"
	>
		{{ config.label }}
	</button>
</template>

<style lang="scss" scoped>
[data-widget='webauthn'] {
	cursor: pointer;
	outline-color: #5d21ab;

	&[data-type='button'] {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-block: 1rem;
		min-height: 2.25rem;
		padding: 0.5rem 1rem;
		font-size: 1rem;
		box-shadow: rgb(0 0 0 / 5%) 0 1px 2px 0;
		border: 1px solid rgb(0 0 0 / 15%);
		border-radius: 4px;
		position: relative;

		&:disabled {
			cursor: not-allowed;
			background-color: #f5f5f5 !important;
			color: #bdbdbd !important;
			border-color: #e0e0e0;
			box-shadow: none;
		}
	}

	+ [data-widget='webauthn'] {
		margin-top: 1rem;
	}
}
</style>
