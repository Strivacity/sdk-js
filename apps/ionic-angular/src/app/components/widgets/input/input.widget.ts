import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { InputWidget as InputWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-input-widget',
	templateUrl: './input.widget.html',
	styleUrls: ['./input.widget.scss'],
	host: {
		'data-widget': 'input',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class InputWidget implements OnInit {
	@Input() formId!: string;
	@Input() config!: InputWidgetConfig;

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

	ngOnInit() {
		// Default value handling
		const value = this.value as string;
		if (value && value.length > 0) {
			this.widgetService.setFormValue(this.formId, this.config.id, value);
		}
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
