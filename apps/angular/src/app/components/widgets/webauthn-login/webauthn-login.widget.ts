import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { PasskeyLoginWidget as WebAuthnLoginWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService, getCredential } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-webauthn-login-widget',
	templateUrl: './webauthn-login.widget.html',
	styleUrls: ['./webauthn-login.widget.scss'],
	host: {
		'data-widget': 'webauthnLogin',
		'[attr.data-type]': 'config.render.type',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class WebAuthnLoginWidget {
	@Input() formId!: string;
	@Input() config!: WebAuthnLoginWidgetConfig;

	get disabled() {
		return !!this.widgetService.loading$.value;
	}

	constructor(protected readonly widgetService: StrivacityWidgetService) {}

	async onClick() {
		if (this.disabled) {
			return;
		}

		try {
			const response = await getCredential(this.config.assertionOptions);
			this.widgetService.setFormValue(this.formId, this.config.id, response);
			await this.widgetService.submitForm(this.formId);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			alert('Authentication failed. Please try again.');
		}
	}

	async onKeyDown(event: KeyboardEvent) {
		if (['Enter', 'Space'].includes(event.code)) {
			await this.onClick();
		}
	}
}
