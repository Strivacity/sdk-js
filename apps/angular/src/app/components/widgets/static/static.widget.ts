import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { StaticWidget as StaticWidgetConfig } from '@strivacity/sdk-core';

@Component({
	encapsulation: ViewEncapsulation.None,
	standalone: true,
	imports: [CommonModule],
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
