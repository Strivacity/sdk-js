import { Component, computed, inject, input } from '@angular/core';
import type { WebauthnLoginWidget } from '@strivacity/sdk-angular';
import { assertWebAuthnCredential, StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-webauthn-login-widget',
	templateUrl: './webauthn-login-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class WebauthnLoginWidgetComponent {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<WebauthnLoginWidget>();

	readonly disabled = computed(() => this.nativeLoginService.loading());

	async onClick(): Promise<void> {
		if (this.disabled()) {
			return;
		}

		try {
			const response = await assertWebAuthnCredential(this.config().assertionOptions);

			this.nativeLoginService.setFormValue(this.formId(), this.config().id, response);
			await this.nativeLoginService.submitForm(this.formId());
		} catch (error) {
			console.error(error);
			alert('Authentication failed. Please try again.');
		}
	}
}
