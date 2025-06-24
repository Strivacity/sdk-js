import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { PhoneWidget as PhoneWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-phone-widget',
	templateUrl: './phone.widget.html',
	styleUrls: ['./phone.widget.scss'],
	host: {
		'data-widget': 'phone',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class PhoneWidget {
	@Input() formId!: string;
	@Input() config!: PhoneWidgetConfig;

	get disabled() {
		return !!this.widgetService.loading$.value || !!this.config.readonly;
	}

	get value() {
		return this.widgetService.forms$.value[this.formId]?.[this.config.id] ?? this.config.value;
	}

	get errorMessage() {
		return this.widgetService.messages$.value[this.formId]?.[this.config.id]?.text;
	}

	get validator() {
		return this.config.validator;
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
