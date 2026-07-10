import { Component, type OnInit, computed, inject, input } from '@angular/core';
import type { SelectWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-select-widget',
	templateUrl: './select-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class SelectWidgetComponent implements OnInit {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<SelectWidget>();

	readonly formValues = computed(() => this.nativeLoginService.forms()[this.formId()] ?? {});
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
}
