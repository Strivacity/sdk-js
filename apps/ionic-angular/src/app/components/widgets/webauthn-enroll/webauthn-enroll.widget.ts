import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { PasskeyEnrollWidget as WebAuthnEnrollWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService, createCredential } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-webauthn-enroll-widget',
	templateUrl: './webauthn-enroll.widget.html',
	styleUrls: ['./webauthn-enroll.widget.scss'],
	host: {
		'data-widget': 'webauthnEnroll',
		'[attr.data-type]': 'config.render.type',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class WebAuthnEnrollWidget {
	@Input() formId!: string;
	@Input() config!: WebAuthnEnrollWidgetConfig;

	get disabled() {
		return !!this.widgetService.loading$.value;
	}

	constructor(protected readonly widgetService: StrivacityWidgetService) {}

	async onClick() {
		if (this.disabled) {
			return;
		}

		try {
			const response = await createCredential(this.config.enrollOptions);
			this.widgetService.setFormValue(this.formId, this.config.id, response);
			await this.widgetService.submitForm(this.formId);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			alert('Enrollment failed. Please try again.');
		}
	}

	async onKeyDown(event: KeyboardEvent) {
		if (['Enter', 'Space'].includes(event.code)) {
			await this.onClick();
		}
	}
}
