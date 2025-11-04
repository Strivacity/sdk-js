import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CloseWidget as CloseWidgetConfig } from '@strivacity/sdk-core';
import { StrivacityWidgetService } from '@strivacity/sdk-angular';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
	selector: 'app-close-widget',
	templateUrl: './close.widget.html',
	styleUrls: ['./close.widget.scss'],
	host: {
		'data-widget': 'close',
		'[attr.data-type]': 'config.render.type',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class CloseWidget {
	@Input() formId!: string;
	@Input() config!: CloseWidgetConfig;

	get disabled() {
		return !!this.widgetService.loading$.value;
	}

	constructor(protected readonly widgetService: StrivacityWidgetService) {}

	onClose() {
		if (this.disabled) {
			return;
		}

		this.widgetService.triggerClose();
	}

	onKeyDown(event: KeyboardEvent) {
		if (['Enter', 'Space'].includes(event.code)) {
			this.onClose();
		}
	}
}
