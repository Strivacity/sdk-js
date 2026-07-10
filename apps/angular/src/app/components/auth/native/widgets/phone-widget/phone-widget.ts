import { Component, type OnInit, computed, inject, input } from '@angular/core';
import type { PhoneWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-phone-widget',
	templateUrl: './phone-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class PhoneWidgetComponent implements OnInit {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<PhoneWidget>();

	readonly value = computed(() => (this.nativeLoginService.forms()[this.formId()]?.[this.config().id] as string) || this.config().value);
	readonly disabled = computed(() => this.nativeLoginService.loading() || !!this.config().readonly);
	readonly errorMessage = computed(() => this.nativeLoginService.messages()[this.formId()]?.[this.config().id]?.text);

	ngOnInit(): void {
		if (this.value()) {
			this.nativeLoginService.setFormValue(this.formId(), this.config().id, this.value());
		}
	}

	onChange(event: Event): void {
		if (this.disabled()) {
			return;
		}

		this.nativeLoginService.setFormValue(this.formId(), this.config().id, (event.target as HTMLInputElement).value);
	}

	async onKeyDown(event: Event): Promise<void> {
		if (this.disabled()) {
			return;
		}

		const input = event.target as HTMLInputElement;

		if (input.reportValidity()) {
			this.nativeLoginService.setFormValue(this.formId(), this.config().id, input.value);
			await this.nativeLoginService.submitForm(this.formId());
		}
	}
}
