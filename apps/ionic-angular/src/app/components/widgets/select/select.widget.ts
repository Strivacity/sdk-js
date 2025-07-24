import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SelectWidget as SelectWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-select-widget',
	templateUrl: './select.widget.html',
	styleUrls: ['./select.widget.scss'],
	host: {
		'data-widget': 'select',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class SelectWidget {
	@Input() formId!: string;
	@Input() config!: SelectWidgetConfig;

	get disabled() {
		return !!this.widgetService.loading$.value || !!this.config.readonly;
	}

	get value() {
		return this.widgetService.forms$.value[this.formId]?.[this.config.id];
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
}
