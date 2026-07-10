import { Component, computed, inject, input } from '@angular/core';
import type { SubmitWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-submit-widget',
	templateUrl: './submit-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class SubmitWidgetComponent {
	private readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<SubmitWidget>();

	protected readonly disabled = computed(() => this.nativeLoginService.loading());

	protected async onSubmit(event: Event): Promise<void> {
		event.preventDefault();

		if (this.disabled()) {
			return;
		}

		const form = (event.target as HTMLElement).closest('form');

		if (form?.dataset['formId'] === this.formId()) {
			form.requestSubmit();
		} else {
			await this.nativeLoginService.submitForm(this.formId());
		}
	}
}
