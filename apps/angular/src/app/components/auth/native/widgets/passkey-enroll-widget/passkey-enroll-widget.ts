import { Component, computed, inject, input } from '@angular/core';
import type { PasskeyEnrollWidget } from '@strivacity/sdk-angular';
import { createWebAuthnCredential, StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-passkey-enroll-widget',
	templateUrl: './passkey-enroll-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class PasskeyEnrollWidgetComponent {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<PasskeyEnrollWidget>();

	readonly disabled = computed(() => this.nativeLoginService.loading());

	async onClick(): Promise<void> {
		if (this.disabled()) {
			return;
		}

		try {
			const response = await createWebAuthnCredential(this.config().enrollOptions);

			this.nativeLoginService.setFormValue(this.formId(), this.config().id, response);
			await this.nativeLoginService.submitForm(this.formId());
		} catch (error) {
			console.error(error);
			alert('Enrollment failed. Please try again.');
		}
	}
}
