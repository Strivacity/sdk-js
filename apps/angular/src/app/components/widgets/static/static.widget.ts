import { Component, Input, ViewEncapsulation } from '@angular/core';
import type { StaticWidget as StaticWidgetConfig } from '@strivacity/sdk-core';

@Component({
	standalone: false,
	encapsulation: ViewEncapsulation.None,
	selector: 'app-static-widget',
	templateUrl: './static.widget.html',
	styleUrls: ['./static.widget.scss'],
	host: {
		'data-widget': 'static',
		'[attr.data-form-id]': 'formId',
		'[attr.data-widget-id]': 'config.id',
	},
})
export class StaticWidget {
	@Input() formId!: string;
	@Input() config!: StaticWidgetConfig;
}
