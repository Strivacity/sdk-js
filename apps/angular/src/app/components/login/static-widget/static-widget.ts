import { Component, input } from '@angular/core';
import type { StaticWidget } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-static-widget',
	templateUrl: './static-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class StaticWidgetComponent {
	readonly formId = input.required<string>();
	readonly config = input.required<StaticWidget>();
}
