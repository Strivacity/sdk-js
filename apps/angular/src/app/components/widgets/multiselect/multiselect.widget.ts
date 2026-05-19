import { Component, Input, ViewEncapsulation } from '@angular/core';
import type { MultiSelectWidget as MultiSelectWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';

@Component({
	standalone: false,
	encapsulation: ViewEncapsulation.None,
	selector: 'app-multiselect-widget',
	templateUrl: './multiselect.widget.html',
	styleUrls: ['./multiselect.widget.scss'],
	host: {
		'data-widget': 'multiselect',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class MultiSelectWidget {
	@Input() formId!: string;
	@Input() config!: MultiSelectWidgetConfig;

	get disabled() {
		return !!this.widgetService.loading$.value || !!this.config.readonly;
	}

	get values() {
		return this.widgetService?.forms$.value[this.formId]?.[this.config.id] || [];
	}

	get errorMessage() {
		return this.widgetService.messages$.value[this.formId]?.[this.config.id]?.text;
	}

	constructor(protected readonly widgetService: StrivacityWidgetService) {
		if (this.config.value?.length) {
			this.widgetService.setFormValue(this.formId, this.config.id, this.config.value);
		}
	}

	onChange(event: Event) {
		if (this.disabled) {
			return;
		}

		const values = (this.widgetService.forms$.value[this.formId]?.[this.config.id] as Array<string>) || [];
		const value = (event.target as HTMLInputElement).value;

		this.widgetService.setFormValue(this.formId, this.config.id, values.includes(value) ? values.filter((v: string) => v !== value) : [...values, value]);
	}
}
