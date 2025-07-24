import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { PasswordWidget as PasswordWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-password-widget',
	templateUrl: './password.widget.html',
	styleUrls: ['./password.widget.scss'],
	host: {
		'data-widget': 'password',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class PasswordWidget {
	@Input() formId!: string;
	@Input() config!: PasswordWidgetConfig;

	get disabled() {
		return !!this.widgetService.loading$.value;
	}

	get errorMessage() {
		return this.widgetService.messages$.value[this.formId]?.[this.config.id]?.text;
	}

	constructor(protected readonly widgetService: StrivacityWidgetService) {}

	onChange(event: Event) {
		if (this.disabled) {
			return;
		}

		this.widgetService.setFormValue(this.formId, this.config.id, (event.target as HTMLInputElement).value);
	}

	async onKeyDown(event: KeyboardEvent) {
		if (this.disabled) {
			return;
		}

		const input = event.target as HTMLInputElement;

		if (input.reportValidity()) {
			this.widgetService.setFormValue(this.formId, this.config.id, (event.target as HTMLInputElement).value);
			await this.widgetService.submitForm(this.formId);
		}
	}
}
