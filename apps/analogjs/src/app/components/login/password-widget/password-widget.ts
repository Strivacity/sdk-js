import { Component, type OnInit, computed, inject, input } from '@angular/core';
import type { PasswordWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-password-widget',
	templateUrl: './password-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class PasswordWidgetComponent implements OnInit {
	protected readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<PasswordWidget>();

	protected readonly value = computed(() => this.nativeLoginService.forms()[this.formId()]?.[this.config().id] as string);
	protected readonly disabled = computed(() => this.nativeLoginService.loading());
	protected readonly errorMessage = computed(() => this.nativeLoginService.messages()[this.formId()]?.[this.config().id]?.text);

	ngOnInit(): void {
		if (this.value()) {
			this.nativeLoginService.setFormValue(this.formId(), this.config().id, this.value());
		}
	}

	protected onChange(event: Event): void {
		if (this.disabled()) {
			return;
		}

		this.nativeLoginService.setFormValue(this.formId(), this.config().id, (event.target as HTMLInputElement).value);
	}

	protected async onKeyDown(event: Event): Promise<void> {
		event.stopPropagation();

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
