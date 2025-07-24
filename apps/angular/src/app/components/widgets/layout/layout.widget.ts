import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { LayoutWidget as LayoutWidgetType } from '@strivacity/sdk-core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-layout-widget',
	templateUrl: './layout.widget.html',
	styleUrls: ['./layout.widget.scss'],
	host: {
		'data-widget': 'layout',
		'[attr.data-form]': 'formId',
		'[attr.data-type]': 'type',
	},
})
export class LayoutWidget {
	@Input() formId!: string;
	@Input() type!: LayoutWidgetType['type'];
	@Input() tag = 'div';

	get disabled() {
		return !!this.widgetService.loading$.value;
	}

	constructor(protected readonly widgetService: StrivacityWidgetService) {}

	async onSubmit(event: Event) {
		event.preventDefault();

		if (this.disabled) {
			return;
		}

		await this.widgetService.submitForm(this.formId);
	}
}
