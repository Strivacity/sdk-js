import { Component, computed, inject, input } from '@angular/core';
import type { CheckboxWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-checkbox-widget',
	templateUrl: './checkbox-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class CheckboxWidgetComponent {
	protected readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<CheckboxWidget>();

	protected readonly disabled = computed(() => this.nativeLoginService.loading());
	protected readonly checked = computed(() => (this.nativeLoginService.forms()[this.formId()]?.[this.config().id] as boolean) || this.config().value || false);
	protected readonly errorMessage = computed(() => this.nativeLoginService.messages()[this.formId()]?.[this.config().id]?.text);

	protected onChange(checked: boolean): void {
		if (this.disabled()) {
			return;
		}

		this.nativeLoginService.setFormValue(this.formId(), this.config().id, checked);
	}
}
