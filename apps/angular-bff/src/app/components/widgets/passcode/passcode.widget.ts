import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { PasscodeWidget as PasscodeWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-passcode-widget',
	templateUrl: './passcode.widget.html',
	styleUrls: ['./passcode.widget.scss'],
	host: {
		'data-widget': 'passcode',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class PasscodeWidget {
	@Input() formId!: string;
	@Input() config!: PasscodeWidgetConfig;

	get disabled() {
		return !!this.widgetService.loading$.value;
	}

	get errorMessage() {
		return this.widgetService.messages$.value[this.formId]?.[this.config.id]?.text;
	}

	get validator() {
		return this.config.validator;
	}

	constructor(protected readonly widgetService: StrivacityWidgetService) {}

	onInput(event: Event) {
		const inputElement = event.target as HTMLInputElement;
		inputElement.value = inputElement.value.replace(/\D/g, '');
	}

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
