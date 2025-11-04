import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SubmitWidget as SubmitWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-submit-widget',
	templateUrl: './submit.widget.html',
	styleUrls: ['./submit.widget.scss'],
	host: {
		'data-widget': 'submit',
		'[attr.data-type]': 'config.render.type',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class SubmitWidget {
	@Input() formId!: string;
	@Input() config!: SubmitWidgetConfig;

	get disabled() {
		return !!this.widgetService.loading$.value;
	}

	constructor(protected readonly widgetService: StrivacityWidgetService) {}

	async onSubmit(event: Event) {
		if (this.disabled) {
			return;
		}

		const form = (event.target as HTMLElement).closest('form');

		if (form?.dataset.formId === this.formId) {
			form.requestSubmit();
		} else {
			await this.widgetService.submitForm(this.formId);
		}
	}

	async onKeyDown(event: KeyboardEvent) {
		if (['Enter', 'Space'].includes(event.code)) {
			await this.onSubmit(event);
		}
	}
}
