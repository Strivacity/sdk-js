import { Component, computed, inject, input } from '@angular/core';
import type { CloseWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-close-widget',
	templateUrl: './close-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class CloseWidgetComponent {
	private readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<CloseWidget>();

	protected readonly disabled = computed(() => this.nativeLoginService.loading());

	protected onClose(): void {
		if (this.disabled()) {
			return;
		}

		this.nativeLoginService.triggerClose();
	}
}
