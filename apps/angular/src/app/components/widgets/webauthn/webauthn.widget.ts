import { CommonModule } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';
import type {
	AssertionCredentialData,
	AssertionPublicKeyCredential,
	AttestationCredentialData,
	AttestationPublicKeyCredential,
	WebAuthnWidget as WebAuthnWidgetConfig,
} from '@strivacity/sdk-core';
import { Base64Url } from '@strivacity/sdk-core/utils/base64Url';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-webauthn-widget',
	templateUrl: './webauthn.widget.html',
	styleUrls: ['./webauthn.widget.scss'],
	host: {
		'data-widget': 'webauthn',
		'[attr.data-type]': 'config.render.type',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class WebAuthnWidget {
	@Input() formId!: string;
	@Input() config!: WebAuthnWidgetConfig;

	private credentialsController: AbortController | null = null;

	get disabled() {
		return !!this.widgetService.loading$.value;
	}

	constructor(protected readonly widgetService: StrivacityWidgetService) {}

	async onSubmit() {
		if (this.disabled) {
			return;
		}

		const metadata = this.config.metadata;
		if (!metadata) {
			return;
		}

		try {
			let response: AssertionCredentialData | AttestationCredentialData | null = null;

			if (metadata?.assertionOptions) {
				response = await this.readCredentials(metadata?.assertionOptions);
			} else if (metadata?.creationOptions) {
				response = await this.createCredential(metadata?.creationOptions);
			}

			const forms = this.widgetService.forms$.value;

			if (!forms[this.formId]) {
				forms[this.formId] = {};
			}

			if (response) {
				forms[this.formId][this.config.id] = response;
			}

			await this.widgetService.submitForm(this.formId);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			alert('Authentication failed. Please try again');
		}
	}

	async createCredential(credentialOptions: PublicKeyCredentialCreationOptions): Promise<AttestationCredentialData> {
		credentialOptions.challenge = Base64Url.decode(credentialOptions.challenge);
		credentialOptions.user.id = Base64Url.decode(credentialOptions.user.id);

		if (credentialOptions.excludeCredentials) {
			credentialOptions.excludeCredentials = credentialOptions.excludeCredentials.map((excludeCredential: PublicKeyCredentialDescriptor) => {
				excludeCredential.id = Base64Url.decode(excludeCredential.id);
				return excludeCredential;
			});
		}

		this.credentialsController?.abort();
		this.credentialsController = new AbortController();

		const credential = (await navigator.credentials.create({
			publicKey: credentialOptions,
			signal: this.credentialsController.signal,
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

	async readCredentials(credentialOptions: PublicKeyCredentialRequestOptions, conditional = false): Promise<AssertionCredentialData> {
		credentialOptions.challenge = Base64Url.decode(credentialOptions.challenge);

		if (credentialOptions.allowCredentials) {
			credentialOptions.allowCredentials = credentialOptions.allowCredentials?.map((allowCredential: PublicKeyCredentialDescriptor) => {
				allowCredential.id = Base64Url.decode(allowCredential.id);
				return allowCredential;
			});
		}

		this.credentialsController?.abort();
		this.credentialsController = new AbortController();

		const credential = (await navigator.credentials.get({
			publicKey: credentialOptions,
			signal: this.credentialsController.signal,
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
}
