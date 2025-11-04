import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { PasskeyEnrollWidget as PasskeyEnrollWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService, createCredential } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-passkey-enroll-widget',
	templateUrl: './passkey-enroll.widget.html',
	styleUrls: ['./passkey-enroll.widget.scss'],
	host: {
		'data-widget': 'passkeyEnroll',
		'[attr.data-type]': 'config.render.type',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class PasskeyEnrollWidget {
	@Input() formId!: string;
	@Input() config!: PasskeyEnrollWidgetConfig;

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
