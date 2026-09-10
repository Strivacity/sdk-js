import { Component, type OnInit, computed, inject, input } from '@angular/core';
import type { MultiSelectWidget } from '@strivacity/sdk-angular';
import { StrivacityNativeLoginService } from '@strivacity/sdk-angular';

@Component({
	selector: 'app-multi-select-widget',
	templateUrl: './multi-select-widget.html',
	styles: [
		`
			:host {
				display: contents;
			}
		`,
	],
})
export class MultiSelectWidgetComponent implements OnInit {
	readonly nativeLoginService = inject(StrivacityNativeLoginService);

	readonly formId = input.required<string>();
	readonly config = input.required<MultiSelectWidget>();

	readonly selectedValues = computed(() => (this.nativeLoginService.forms()[this.formId()]?.[this.config().id] as Array<string>) ?? []);
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

		const values = this.selectedValues();
		const value = (event.target as HTMLInputElement).value;

		this.nativeLoginService.setFormValue(this.formId(), this.config().id, values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
	}
}
